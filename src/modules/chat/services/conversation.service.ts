import { Injectable } from '@nestjs/common';
import { ConversationRepository } from '../repositories/conversation.repository';
import { ConversationParticipantsRepository } from '../repositories/conversationParticipants.repository';
import { PresenceService } from '../../realtime/services/presence.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class ConversationService {
  constructor(
    private conversationRepository: ConversationRepository,
    private conversationParticipantsRepository: ConversationParticipantsRepository,
    @Inject(forwardRef(() => PresenceService))
    private presenceService: PresenceService,
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
      data: await Promise.all(conversations.map(async (c: any) => ({
        id: c.id.toString(),
        type: c.type,
        created_at: c.created_at,
        participants: await Promise.all(c.conversation_participants.map(async (p: any) => ({
          id: p.users.id.toString(),
          username: p.users.username,
          name: p.users.name,
          avatar_url: p.users.avatar_url,
          joined_at: p.joined_at,
          last_seen_message_id: p.last_seen_message_id?.toString(),
          is_online: await this.presenceService.isOnline(p.users.id.toString()),
          last_online: await this.presenceService.getLastOnline(p.users.id.toString()),
        }))),
        last_message: c.last_message,
        last_message_id: c.last_message_id?.toString(),
        last_sender_id: c.last_sender_id?.toString(),
        last_message_at: c.last_message_at,
        updated_at: c.updated_at,
        unread_count: c.conversation_participants.find((p: any) => p.users.id.toString() === userId.toString())?.unread_count || 0,
      }))),
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
        items: await Promise.all(result.items.map(async (c: any) => ({
          id: c.id.toString(),
          type: c.type,
          created_at: c.created_at,
          participants: await Promise.all(c.conversation_participants.map(async (p: any) => ({
            id: p.users.id.toString(),
            username: p.users.username,
            name: p.users.name,
            avatar_url: p.users.avatar_url,
            joined_at: p.joined_at,
            last_seen_message_id: p.last_seen_message_id?.toString(),
            is_online: await this.presenceService.isOnline(p.users.id.toString()),
            last_online: await this.presenceService.getLastOnline(p.users.id.toString()),
          }))),
          last_message: c.last_message,
          last_message_id: c.last_message_id?.toString(),
          last_sender_id: c.last_sender_id?.toString(),
          last_message_at: c.last_message_at,
          updated_at: c.updated_at,
          unread_count: c.conversation_participants.find((p: any) => p.users.id.toString() === userId.toString())?.unread_count || 0,
        }))),
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
      data: await Promise.all(participants.map(async (p: any) => ({
        userId: p.users.id.toString(),
        username: p.users.username,
        name: p.users.name,
        avatar_url: p.users.avatar_url,
        joined_at: p.joined_at,
        last_seen_message_id: p.last_seen_message_id?.toString(),
        is_online: await this.presenceService.isOnline(p.users.id.toString()),
        last_online: await this.presenceService.getLastOnline(p.users.id.toString()),
      }))),
    };
  }
  /**
   * Lấy chi tiết một conversation theo ID
   */
  async getConversationById(conversationId: string, userId: string) {
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
        participants: await Promise.all(c.conversation_participants.map(async (p: any) => ({
          id: p.users.id.toString(),
          username: p.users.username,
          name: p.users.name,
          avatar_url: p.users.avatar_url,
          joined_at: p.joined_at,
          last_seen_message_id: p.last_seen_message_id?.toString(),
          unread_count: p.unread_count,
          is_online: await this.presenceService.isOnline(p.users.id.toString()),
          last_online: await this.presenceService.getLastOnline(p.users.id.toString()),
        }))),
        unread_count: c.conversation_participants.find((p: any) => p.users.id.toString() === userId.toString())?.unread_count || 0,
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
          participants: await Promise.all(existing.conversation_participants.map(async (p: any) => ({
            id: p.users.id.toString(),
            username: p.users.username,
            name: p.users.name,
            avatar_url: p.users.avatar_url,
            unread_count: p.unread_count,
            joined_at: p.joined_at,
            last_seen_message_id: p.last_seen_message_id?.toString(),
            is_online: await this.presenceService.isOnline(p.users.id.toString()),
            last_online: await this.presenceService.getLastOnline(p.users.id.toString()),
          }))),
          last_message: existing.last_message,
          last_message_id: existing.last_message_id?.toString(),
          last_sender_id: existing.last_sender_id?.toString(),
          last_message_at: existing.last_message_at,
          updated_at: existing.updated_at,
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
        participants: await Promise.all(newConv.conversation_participants.map(async (p: any) => ({
          id: p.users.id.toString(),
          username: p.users.username,
          name: p.users.name,
          avatar_url: p.users.avatar_url,
          unread_count: p.unread_count,
          joined_at: p.joined_at,
          last_seen_message_id: p.last_seen_message_id?.toString(),
          is_online: await this.presenceService.isOnline(p.users.id.toString()),
          last_online: await this.presenceService.getLastOnline(p.users.id.toString()),
        }))),
        last_message: newConv.last_message,
        last_message_id: newConv.last_message_id?.toString(),
        last_sender_id: newConv.last_sender_id?.toString(),
        last_message_at: newConv.last_message_at,
        updated_at: newConv.updated_at,
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
