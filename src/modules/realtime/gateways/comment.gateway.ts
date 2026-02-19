import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PostCommentService } from '../../posts/services/post-comment.service';


@WebSocketGateway({
  cors: {
    origin: process.env.FRONT_END_URL,
    credentials: true,
  },
})
export class CommentGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => PostCommentService))
    private readonly postCommentService: PostCommentService,
  ) {}

  broadcastComment(postId: string, comment: any) {
    this.server.to(`post:${postId}`).emit('new_comment', comment);
  }

  broadcastDeleteComment(postId: string, commentId: string) {
    this.server.to(`post:${postId}`).emit('delete_comment', {
      post_id: postId,
      comment_id: commentId,
    });
  }

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

  // @SubscribeMessage('new_comment')
  // async handleComment(
  //   @MessageBody() data: { postId: string; content: string; parentId?: string },
  //   @ConnectedSocket() socket: Socket,
  // ) {
  //   console.log('New comment:', data);
  //   const user = socket.data.user;

  //   if (!user) {
  //     // Should handle unauthorized
  //     console.log('Unauthorized comment attempt');
  //     return; 
  //   }

  //   try {
  //     const response = await this.postCommentService.createComment({
  //       userId: user.sub || user.id, // Depends on JWT payload
  //       postId: data.postId,
  //       content: data.content,
  //       parentId: data.parentId,
  //     });

  //     // The service already broadcasts the comment
  //     // this.server.to(`post:${data.postId}`).emit('new_comment', response);

  //     return { status: 'ok', data: response.data };
  //   } catch (error) {
  //     console.error('Error creating comment:', error);
  //     return { status: 'error', message: 'Failed to create comment' };
  //   }
  // }
}
