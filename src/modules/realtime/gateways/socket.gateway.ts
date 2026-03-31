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
import { PresenceService } from '../services/presence.service';
import { ConversationService } from '../../chat/services/conversation.service';
import { MessageService } from '../../chat/services/message.service';
import { PostCommentService } from '../../posts/services/post-comment.service';
import { FriendsService } from '../../friends/friends.service';
import { UsersService } from '../../users/users.service';
import { RecommendService } from '../../recommend/recommend.service';
import { StoriesService } from '../../stories/stories.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONT_END_URL,
    credentials: true,
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
    private readonly presenceService: PresenceService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly friendsService: FriendsService,
    private readonly usersService: UsersService,
    private readonly recommendService: RecommendService,
    @Inject(forwardRef(() => StoriesService))
    private readonly storiesService: StoriesService,
    @Inject(forwardRef(() => PostCommentService))
    private readonly postCommentService: PostCommentService,
  ) { }

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
        const accessTokenCookie = cookies.find((c) =>
          c.trim().startsWith('accessToken='),
        );
        if (accessTokenCookie) {
          token = accessTokenCookie.split('=')[1].trim();
        }
      }

      if (!token) {
        this.logger.warn(
          `No token found for socket ${socket.id}, assigning guest role`,
        );
        socket.data.user = { id: `guest_${socket.id}`, role: 'guest' };
        return next();
      }

      try {
        const jwtToken = token.startsWith('Bearer ')
          ? token.split(' ')[1]
          : token;
        const payload = await this.jwtService.verifyAsync(jwtToken);
        socket.data.user = payload;
        this.logger.log(
          `Socket ${socket.id} authenticated for user ${payload.sub || payload.id}`,
        );
        next();
      } catch (error) {
        this.logger.error(
          `Authentication error for socket ${socket.id}:`,
          error.message,
        );
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
        const result =
          await this.conversationService.getUserConversations(userId);
        const conversations = result.data || [];
        for (const c of conversations) {
          socket.join(`conversation_${c.id}`);
        }
      } catch (error) {
        this.logger.error('Error joining conversation rooms:', error);
      }

      // 3. Mark user as online in Redis
      const isFirst = await this.presenceService.markOnline(
        userId.toString(),
        socket.id,
      );

      // 4. Thông báo cho những người liên quan (trong cùng hội thoại)
      if (isFirst) {
        await this.notifyStatusChange(userId.toString(), true);
      }
    } else {
      this.logger.log(`Guest connected (Socket ID: ${socket.id})`);
    }
  }

  handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    const userId = user?.sub || user?.id;

    if (userId && user.role !== 'guest') {
      this.logger.log(`User disconnected: ${userId} (Socket ID: ${socket.id})`);

      // Mark as offline in Redis
      this.presenceService
        .markOffline(userId.toString(), socket.id)
        .then(async (isFullyOffline) => {
          console.log('User disconnected:', userId, isFullyOffline);
          if (isFullyOffline) {
            await this.notifyStatusChange(userId.toString(), false);
          }
        });
    } else {
      this.logger.log(`Guest disconnected (Socket ID: ${socket.id})`);
    }
  }

  // ─── Chat Gateway Logic ──────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody()
    payload: {
      conversationId: string;
      content?: string;
      attachments?: { url: string; type: string }[];
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user || user.role === 'guest') {
      this.logger.warn(
        `Rejected send_message from unauthenticated socket ${client.id}`,
      );
      return;
    }

    const senderId = (user.sub || user.id).toString();
    const roomName = `conversation_${payload.conversationId}`;

    // Đảm bảo client đã join vào room conversation (đặc biệt cho conv mới tạo)
    client.join(roomName);
    console.log('payload', payload);

    try {
      const resultMessage = await this.messageService.sendMessage({
        conversationId: payload.conversationId,
        senderId: senderId,
        content: payload.content,
        attachments: payload.attachments,
      });

      if (!resultMessage.success) return;

      const messageData = resultMessage.data;

      // Emit message tới room của conversation
      this.server.to(roomName).emit('new_message', messageData);

      // Lấy danh sách participants để thông báo cập nhật (hoặc cho những người chưa join room)
      const result = await this.conversationService.getParticipants(
        payload.conversationId,
      );
      const participants = result.data || [];

      for (const p of participants) {
        const pId = p.userId.toString();
        // Không emit lại message qua user room cho người gửi (đã nhận qua room conversation)
        // if (pId !== senderId) {
        //   // Gửi thông báo tin nhắn mới qua user room cá nhân của họ
        //   this.server.to(`user_${pId}`).to(pId).emit('new_message', messageData);
        // }

        // Cập nhật danh sách hội thoại (unread count, last message, etc.)
        this.server.to(`user_${pId}`).to(pId).emit('conversation_updated', {
          conversationId: payload.conversationId,
          lastMessage: messageData,
          senderId,
          message_id: messageData.id,
        });

        // ─── Gửi event tương tác xuống hệ thống CF ───
        if (pId !== senderId) {
          this.recommendService
            .logEvent({
              actor_user_id: senderId,
              target_user_id: pId,
              event_type: 'message',
              timestamp: new Date().toISOString(),
              metadata: {
                conversationId: payload.conversationId,
                messageId: messageData.id,
                source: 'chat_gateway',
              },
            })
            .catch((err) =>
              this.logger.error('Failed to log message event to CF:', err.message),
            );
        }
      }
    } catch (error) {
      this.logger.error('Error handling send_message:', error);
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @MessageBody() payload: { conversationId: string; lastMessageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user || user.role === 'guest') return;

    const userId = (user.sub || user.id).toString();

    try {
      const result = await this.conversationService.markRead(
        payload.conversationId,
        userId,
        payload.lastMessageId,
      );

      if (result.success) {
        const roomName = `conversation_${payload.conversationId}`;

        // Thông báo cho tất cả mọi người trong cuộc trò chuyện (bao gồm cả người gửi)
        this.server.to(roomName).emit('user_read_message', {
          conversation_id: payload.conversationId,
          user_id: userId,
          last_seen_message_id: payload.lastMessageId,
        });
        console.log('User read message:', {
          conversation_id: payload.conversationId,
          user_id: userId,
          last_seen_message_id: payload.lastMessageId,
        });
      }
    } catch (error) {
      this.logger.error('Error handling mark_read:', error);
    }
  }

  // ─── Post / Comment Gateway Logic ───────────────────────────────────────────

  @SubscribeMessage('join_post')
  handleJoinPost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.join(`post:${data.postId}`);
    this.logger.log(
      `Socket ${socket.id} joined post room: post:${data.postId}`,
    );
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

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const user = client.data.user;
    if (!user || user.role === 'guest') return;

    const userId = (user.sub || user.id).toString();
    await this.presenceService.handleHeartbeat(userId);

    // Trả về ack cho client
    client.emit('heartbeat_ack', { status: 'online', timestamp: new Date() });
  }

  /**
   * Get list of online users
   */
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { limit?: number; exclude?: string[] },
  ) {
    const user = client.data.user;
    if (!user || user.role === 'guest') return [];

    const userId = (user.sub || user.id).toString();

    try {
      // 1. Lấy danh sách ID bạn bè
      const friendIds = await this.friendsService.getFriendIds(userId);
      const friendIdStrings = friendIds.map((id) => id.toString());

      // 2. Lấy danh sách toàn bộ ID đang online từ Redis
      const allOnlineIds = await this.presenceService.getOnlineUserIds();

      // 3. Tìm giao điểm (Chỉ lấy bạn bè đang online)
      let onlineFriendIds = friendIdStrings.filter((id) =>
        allOnlineIds.includes(id),
      );

      // 4. Áp dụng loại trừ (exclude) các ID đã hiển thị trên FE
      if (payload?.exclude && payload.exclude.length > 0) {
        const excludeList = payload.exclude;
        onlineFriendIds = onlineFriendIds.filter(
          (id) => !excludeList.includes(id),
        );
      }

      // 5. Áp dụng giới hạn (limit)
      if (payload?.limit && payload.limit > 0) {
        onlineFriendIds = onlineFriendIds.slice(0, payload.limit);
      }

      if (onlineFriendIds.length === 0) return [];

      // 6. Lấy thông tin chi tiết từ Database
      const users = await this.usersService.findByIds(onlineFriendIds);

      // 7. Thêm thông tin has_story
      return await Promise.all(
        users.map(async (u) => ({
          ...u,
          has_story: await this.storiesService.hasStory(u.id.toString()),
        })),
      );
    } catch (error) {
      this.logger.error('Error getting online friends:', error);
      return [];
    }
  }

  /**
   * Thông báo trạng thái online/offline cho tất cả participants trong các cuộc trò chuyện của user
   */
  private async notifyStatusChange(userId: string, isOnline: boolean) {
    try {
      const [lastOnline, hasStory] = await Promise.all([
        isOnline
          ? Promise.resolve(new Date().toISOString())
          : this.presenceService.getLastOnline(userId),
        this.storiesService.hasStory(userId),
      ]);

      // Lấy danh sách conversations để biết cần notify vào room nào
      const result =
        await this.conversationService.getUserConversations(userId);
      const conversations = result.data || [];

      const payload = {
        userId,
        is_online: isOnline,
        last_online: lastOnline,
        has_story: hasStory,
      };

      for (const conv of conversations) {
        const roomName = `conversation_${conv.id}`;
        this.server.to(roomName).emit('user_status_changed', payload);
      }

      // Thông báo cho danh sách bạn bè qua room cá nhân của họ
      const friendIds = await this.friendsService.getFriendIds(userId);
      for (const friendId of friendIds) {
        console.log('Notifying status change for user', friendId, isOnline);
        const pId = friendId.toString();
        this.server
          .to(`user_${pId}`)
          .to(pId)
          .emit('user_status_changed', payload);
      }

      this.logger.debug(
        `Notified status change for user ${userId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`,
      );
    } catch (error) {
      this.logger.error(`Error notifying status change: ${error.message}`);
    }
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

  // ─── Reel / Comment Gateway Logic ───────────────────────────────────────────

  @SubscribeMessage('join_reel')
  handleJoinReel(
    @MessageBody() data: { reelId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.join(`reel:${data.reelId}`);
    this.logger.log(
      `Socket ${socket.id} joined reel room: reel:${data.reelId}`,
    );
  }

  @SubscribeMessage('leave_reel')
  handleLeaveReel(
    @MessageBody() data: { reelId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.leave(`reel:${data.reelId}`);
    this.logger.log(`Socket ${socket.id} left reel room: reel:${data.reelId}`);
  }

  broadcastReelComment(reelId: string, comment: any) {
    this.server.to(`reel:${reelId}`).emit('new_reel_comment', comment);
  }

  broadcastDeleteReelComment(reelId: string, commentId: string) {
    this.server.to(`reel:${reelId}`).emit('delete_reel_comment', {
      reel_id: reelId,
      comment_id: commentId,
    });
  }
}
