import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, data: any) {
    if (this.server) {
      this.server.to(userId).emit(event, data);
    }
  }

  emitToAll(event: string, data: any) {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  emitToRoom(room: string, event: string, data: any) {
    if (this.server) {
      this.server.to(room).emit(event, data);
    }
  }
}
