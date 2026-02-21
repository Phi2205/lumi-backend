import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService } from '../realtime.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONT_END_URL,
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.setServer(server);

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
        const jwtToken = token.split(' ')[1] || token;
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
}
