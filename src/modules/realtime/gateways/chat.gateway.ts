import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from '../realtime.service';

@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  @SubscribeMessage('send_message')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('Received message:', data);
    // Logic gửi tin nhắn (ví dụ qua Service)
    this.server.emit('receive_message', data);
  }
}
