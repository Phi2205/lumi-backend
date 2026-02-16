import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class PostGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('new_post')
  handleNewPost(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('New post:', data);
    // Logic xử lý post
  }
}
