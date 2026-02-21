import { Injectable } from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';

@Injectable()
export class MessageService {
  constructor(private messageRepository: MessageRepository) {}

  /**
   * Gửi tin nhắn
   */
  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
    type?: string;
  }) {
    const message = await this.messageRepository.create(data);

    return {
      id: message.id.toString(),
      conversation_id: message.conversation_id.toString(),
      content: message.content,
      type: message.type,
      created_at: message.created_at,
      seen_at: message.seen_at,
      sender: {
        id: message.users.id.toString(),
        username: message.users.username,
        name: message.users.name,
        avatar_url: message.users.avatar_url,
      },
    };
  }

  /**
   * Lấy lịch sử tin nhắn
   */
  async getMessages(conversationId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const messages = await this.messageRepository.findByConversation(
      conversationId,
      skip,
      limit,
    );

    return messages.map((m) => ({
      id: m.id.toString(),
      conversation_id: m.conversation_id.toString(),
      content: m.content,
      type: m.type,
      created_at: m.created_at,
      seen_at: m.seen_at,
      sender: {
        id: m.users.id.toString(),
        username: m.users.username,
        name: m.users.name,
        avatar_url: m.users.avatar_url,
      },
    }));
  }
}
