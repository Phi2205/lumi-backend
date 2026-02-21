import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService } from '../realtime.service';
import { ConversationService } from '../../chat/services/conversation.service';
import { MessageService } from '../../chat/services/message.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONT_END_URL,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const user = this.jwtService.verify(token);

      client.data.user = user;
      client.join(`user_${user.id}`);
      const conversations =
        await this.conversationService.getUserConversations(user.id);

      for (const c of conversations) {
        client.join(`conversation_${c.id}`);
      }
    } catch (error) {
      client.disconnect();
    }
  }

  @SubscribeMessage('send_message')
  async handleSend(
    @MessageBody() payload: { conversationId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    const message = await this.messageService.sendMessage({
      conversationId: payload.conversationId,
      senderId: user.id,
      content: payload.content,
    });

    // 1️⃣ Emit realtime message
    this.server
      .to(`conversation_${payload.conversationId}`)
      .emit('new_message', message);

    // 2️⃣ Emit update conversation list cho từng user
    const participants =
      await this.conversationService.getParticipants(payload.conversationId);

    for (const p of participants) {
      this.server
        .to(`user_${p.userId}`)
        .emit('conversation_updated', {
          conversationId: payload.conversationId,
          lastMessage: message,
        });
    }
  }
}

