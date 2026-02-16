import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers['authorization'];

      if (!token) {
        // Guest connection
        socket.data.user = { id: `guest_${socket.id}`, role: 'guest' };
        return next();
      }

      try {
        const jwtToken = token.split(' ')[1] || token; // Handle 'Bearer ' prefix optionally
        const payload = await this.jwtService.verifyAsync(jwtToken);
        socket.data.user = payload;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  handleConnection(socket: Socket) {
    const user = socket.data.user;
    const userId = user?.sub || user?.id;

    if (userId) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined room ${userId}`);
    }

    console.log(
      'User connected:',
      socket.id,
      userId,
      user?.role || 'user',
    );
  }

  handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    const userId = user?.sub || user?.id;

    if (userId) {
      socket.leave(userId);
      console.log(`Socket ${socket.id} left room ${userId}`);
    }

    console.log('User disconnected:', socket.id);
  }

  @SubscribeMessage('send_message')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log('Received:', data);

    this.server.emit('receive_message', data);
  }
}
