import { Injectable } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ConversationParticipantsRepository } from '../repositories/conversationParticipants.repository';

@Injectable()
export class ConversationService {
  constructor(
    private conversationRepository: ConversationRepository,
    private conversationParticipantsRepository: ConversationParticipantsRepository,
  ) { }

  /**
   * Lấy tất cả conversations mà user tham gia
   */
  async getUserConversations(userId: string) {
    const conversations =
      await this.conversationRepository.getUserConversations(userId);

    return {
      success: true,
      message: 'Get user conversations successfully',
      data: conversations.map((c: any) => ({
        id: c.id.toString(),
        type: c.type,
        created_at: c.created_at,
        participants: c.conversation_participants.map((p: any) => ({
          id: p.users.id.toString(),
          username: p.users.username,
          name: p.users.name,
          avatar_url: p.users.avatar_url,
          joined_at: p.joined_at,
          last_seen_message_id: p.last_seen_message_id?.toString(),
        })),
        last_message: c.last_message,
        last_message_id: c.last_message_id?.toString(),
        last_sender_id: c.last_sender_id?.toString(),
        last_message_at: c.last_message_at,
        updated_at: c.updated_at,
        unread_count: c.conversation_participants.find((p: any) => p.users.id.toString() === userId.toString())?.unread_count || 0,
      })),
    };
  }

  /**
   * Lấy danh sách conversations của user với phân trang
   */
  async getUserConversationsPaginated(userId: string, page: number = 1, limit: number = 10) {
    const result = await this.conversationParticipantsRepository.findByUserId(userId, page, limit);

    return {
      success: true,
      message: 'Get conversations successfully',
      data: {
        items: result.items.map((c: any) => ({
          id: c.id.toString(),
          type: c.type,
          created_at: c.created_at,
          participants: c.conversation_participants.map((p: any) => ({
            id: p.users.id.toString(),
            username: p.users.username,
            name: p.users.name,
            avatar_url: p.users.avatar_url,
            joined_at: p.joined_at,
            last_seen_message_id: p.last_seen_message_id?.toString(),
          })),
          last_message: c.last_message,
          last_message_id: c.last_message_id?.toString(),
          last_sender_id: c.last_sender_id?.toString(),
          last_message_at: c.last_message_at,
          updated_at: c.updated_at,
          unread_count: c.unread_count || 0,
        })),
        pagination: {
          total: result.meta.total,
          page: result.meta.page,
          limit: result.meta.limit,
          totalPages: result.meta.totalPages,
          hasNextPage: result.meta.page < result.meta.totalPages,
          hasPreviousPage: result.meta.page > 1,
        },
      },
    };
  }

  /**
   * Lấy danh sách participants của một conversation
   */
  async getParticipants(conversationId: string) {
    const participants =
      await this.conversationRepository.getParticipants(conversationId);

    return {
      success: true,
      message: 'Get participants successfully',
      data: participants.map((p: any) => ({
        userId: p.users.id.toString(),
        username: p.users.username,
        name: p.users.name,
        avatar_url: p.users.avatar_url,
        joined_at: p.joined_at,
        last_seen_message_id: p.last_seen_message_id?.toString(),
      })),
    };
  }
  /**
   * Lấy chi tiết một conversation theo ID
   */
  async getConversationById(conversationId: string) {
    const c = await this.conversationRepository.findById(conversationId);

    if (!c) {
      return {
        success: false,
        message: 'Conversation not found',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Get conversation details successfully',
      data: {
        id: c.id.toString(),
        type: c.type,
        created_at: c.created_at,
        participants: c.conversation_participants.map((p: any) => ({
          id: p.users.id.toString(),
          username: p.users.username,
          name: p.users.name,
          avatar_url: p.users.avatar_url,
          joined_at: p.joined_at,
          last_seen_message_id: p.last_seen_message_id?.toString(),
        })),
        last_message: c.last_message,
        last_message_id: c.last_message_id?.toString(),
        last_sender_id: c.last_sender_id?.toString(),
        last_message_at: c.last_message_at,
        updated_at: c.updated_at,
      },
    };
  }

  /**
   * Tìm hoặc tạo cuộc trò chuyện riêng tư giữa 2 người
   */
  async getOrCreatePrivateConversation(userId1: string, userId2: string) {
    if (userId1 === userId2) {
      return {
        success: false,
        message: 'Cannot create conversation with yourself',
        data: null,
      };
    }

    // Tìm xem đã có conversation riêng tư giữa 2 người chưa
    const existing = await this.conversationRepository.findPrivateConversation(userId1, userId2);

    if (existing) {
      return {
        success: true,
        message: 'Get private conversation successfully',
        data: {
          id: existing.id.toString(),
          type: existing.type,
          participants: existing.conversation_participants.map((p: any) => ({
            id: p.users.id.toString(),
            username: p.users.username,
            name: p.users.name,
            avatar_url: p.users.avatar_url,
          })),
        },
      };
    }

    // Nếu chưa có thì tạo mới
    const newConv = await this.conversationRepository.createPrivateConversation(userId1, userId2);

    return {
      success: true,
      message: 'Created private conversation successfully',
      data: {
        id: newConv.id.toString(),
        type: newConv.type,
        participants: newConv.conversation_participants.map((p: any) => ({
          id: p.users.id.toString(),
          username: p.users.username,
          name: p.users.name,
          avatar_url: p.users.avatar_url,
        })),
      },
    };
  }

  /**
   * Đánh dấu cuộc trò chuyện là đã đọc
   */
  async markRead(conversationId: string, userId: string, lastMessageId: string) {
    try {
      await this.conversationParticipantsRepository.markAsRead(
        conversationId,
        userId,
        lastMessageId,
      );

      return {
        success: true,
        message: 'Marked as read successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to mark as read',
      };
    }
  }
}
