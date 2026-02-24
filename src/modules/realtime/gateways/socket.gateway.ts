import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Inject, forwardRef, Logger } from '@nestjs/common';
import { RealtimeService } from '../realtime.service';
import { ConversationService } from '../../chat/services/conversation.service';
import { MessageService } from '../../chat/services/message.service';
import { PostCommentService } from '../../posts/services/post-comment.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONT_END_URL,
    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => PostCommentService))
    private readonly postCommentService: PostCommentService,
  ) {}

  /**
   * Cấu hình socket server sau khi khởi tạo
   */
  afterInit(server: Server) {
    this.realtimeService.setServer(server);

    // Middleware để xác thực JWT token cho mỗi connection
    server.use(async (socket: Socket, next) => {
      let token =
        socket.handshake.auth.token ||
        socket.handshake.headers['authorization'];

      // Nếu không có token trong auth/headers, kiểm tra trong cookies
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        const accessTokenCookie = cookies.find(c => c.trim().startsWith('accessToken='));
        if (accessTokenCookie) {
          token = accessTokenCookie.split('=')[1].trim();
        }
      }

      if (!token) {
        this.logger.warn(`No token found for socket ${socket.id}, assigning guest role`);
        socket.data.user = { id: `guest_${socket.id}`, role: 'guest' };
        return next();
      }

      try {
        const jwtToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
        const payload = await this.jwtService.verifyAsync(jwtToken);
        socket.data.user = payload;
        this.logger.log(`Socket ${socket.id} authenticated for user ${payload.sub || payload.id}`);
        next();
      } catch (error) {
        this.logger.error(`Authentication error for socket ${socket.id}:`, error.message);
        // Gán role guest thay vì reject connection để tránh loop reconnect nếu user ko logout
        socket.data.user = { id: `guest_${socket.id}`, role: 'guest' };
        next();
      }
    });

  }

  /**
   * Xử lý khi có client kết nối (chỉ connect 1 lần duy nhất)
   */
  async handleConnection(socket: Socket) {
    const user = socket.data.user;
    const userId = user?.sub || user?.id;

    if (userId && user.role !== 'guest') {
      // 1. Join vào room cá nhân của user
      socket.join(`user_${userId}`);
      socket.join(userId.toString()); // Hỗ trợ cả 2 định dạng room
      
      this.logger.log(`User connected: ${userId} (Socket ID: ${socket.id})`);

      // 2. Join vào tất cả các room conversation của user này
      try {
        const result = await this.conversationService.getUserConversations(userId);
        const conversations = result.data || [];
        for (const c of conversations) {
          socket.join(`conversation_${c.id}`);
        }
      } catch (error) {
        this.logger.error('Error joining conversation rooms:', error);
      }
    } else {
      this.logger.log(`Guest connected (Socket ID: ${socket.id})`);
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  // ─── Chat Gateway Logic ──────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() payload: { conversationId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user || user.role === 'guest') {
      this.logger.warn(`Rejected send_message from unauthenticated socket ${client.id}`);
      return;
    }

    const senderId = (user.sub || user.id).toString();
    const roomName = `conversation_${payload.conversationId}`;
    
    // Đảm bảo client đã join vào room conversation (đặc biệt cho conv mới tạo)
    client.join(roomName);

    try {
      const resultMessage = await this.messageService.sendMessage({
        conversationId: payload.conversationId,
        senderId: senderId,
        content: payload.content,
      });

      if (!resultMessage.success) return;

      const messageData = resultMessage.data;

      // Emit message tới room của conversation
      this.server.to(roomName).emit('new_message', messageData);

      // Lấy danh sách participants để thông báo cập nhật (hoặc cho những người chưa join room)
      const result = await this.conversationService.getParticipants(payload.conversationId);
      const participants = result.data || [];

      for (const p of participants) {
        const pId = p.userId.toString();
        // Không emit lại message qua user room cho người gửi (đã nhận qua room conversation)
        if (pId !== senderId) {
          // Gửi thông báo tin nhắn mới qua user room cá nhân của họ
          this.server.to(`user_${pId}`).to(pId).emit('new_message', messageData);
        }

        // Cập nhật danh sách hội thoại (unread count, last message, etc.)
        this.server
          .to(`user_${pId}`)
          .to(pId)
          .emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: messageData,
          });
      }
    } catch (error) {
      this.logger.error('Error handling send_message:', error);
    }
  }


  // ─── Post / Comment Gateway Logic ───────────────────────────────────────────

  @SubscribeMessage('join_post')
  handleJoinPost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.join(`post:${data.postId}`);
    this.logger.log(`Socket ${socket.id} joined post room: post:${data.postId}`);
  }

  @SubscribeMessage('leave_post')
  handleLeavePost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.leave(`post:${data.postId}`);
    this.logger.log(`Socket ${socket.id} left post room: post:${data.postId}`);
  }

  @SubscribeMessage('new_post')
  handleNewPost(@MessageBody() data: any) {
    this.logger.log('New post socket event received:', data);
  }

  /**
   * Các hàm helper để broadcast từ Service
   */
  broadcastComment(postId: string, comment: any) {
    this.server.to(`post:${postId}`).emit('new_comment', comment);
  }

  broadcastDeleteComment(postId: string, commentId: string) {
    this.server.to(`post:${postId}`).emit('delete_comment', {
      post_id: postId,
      comment_id: commentId,
    });
  }
}
