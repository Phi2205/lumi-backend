import { Injectable } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';

@Injectable()
export class ConversationService {
  constructor(
    private conversationRepository: ConversationRepository,
  ) {}

  /**
   * Lấy tất cả conversations mà user tham gia
   */
  async getUserConversations(userId: string) {
    const conversations =
      await this.conversationRepository.getUserConversations(userId);

    return conversations.map((c) => ({
      id: c.id.toString(),
      type: c.type,
      created_at: c.created_at,
      participants: c.conversation_participants.map((p) => ({
        id: p.users.id.toString(),
        username: p.users.username,
        name: p.users.name,
        avatar_url: p.users.avatar_url,
        joined_at: p.joined_at,
      })),
      last_message: c.messages[0]
        ? {
            id: c.messages[0].id.toString(),
            content: c.messages[0].content,
            type: c.messages[0].type,
            created_at: c.messages[0].created_at,
          }
        : null,
    }));
  }

  /**
   * Lấy danh sách participants của một conversation
   */
  async getParticipants(conversationId: string) {
    const participants =
      await this.conversationRepository.getParticipants(conversationId);

    return participants.map((p) => ({
      userId: p.users.id.toString(),
      username: p.users.username,
      name: p.users.name,
      avatar_url: p.users.avatar_url,
      joined_at: p.joined_at,
    }));
  }
}
