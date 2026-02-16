import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PostCommentService } from '../../posts/services/post-comment.service';


@WebSocketGateway({ cors: true })
export class CommentGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly postCommentService: PostCommentService) {}

  @SubscribeMessage('join_post')
  handleJoinPost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.join(`post:${data.postId}`);
    console.log(`Socket ${socket.id} joined post:${data.postId}`);
  }

  @SubscribeMessage('leave_post')
  handleLeavePost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    socket.leave(`post:${data.postId}`);
    console.log(`Socket ${socket.id} left post:${data.postId}`);
  }

  @SubscribeMessage('new_comment')
  async handleComment(
    @MessageBody() data: { postId: string; content: string; parentId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('New comment:', data);
    const user = socket.data.user;

    if (!user) {
      // Should handle unauthorized
      console.log('Unauthorized comment attempt');
      return; 
    }

    try {
      const comment = await this.postCommentService.createComment({
        userId: user.sub || user.id, // Depends on JWT payload
        postId: data.postId,
        content: data.content,
        parentId: data.parentId,
      });

      // Broadcast to everyone in the post room
      this.server.to(`post:${data.postId}`).emit('new_comment', comment);

      return { status: 'ok', data: comment };
    } catch (error) {
      console.error('Error creating comment:', error);
      return { status: 'error', message: 'Failed to create comment' };
    }
  }
}
