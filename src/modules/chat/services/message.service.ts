import { Injectable } from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { ConversationParticipantsRepository } from '../repositories/conversationParticipants.repository';

@Injectable()
export class MessageService {
  constructor(
    private messageRepository: MessageRepository,
    private participationRepo: ConversationParticipantsRepository,
  ) { }

  /**
   * Gửi tin nhắn và cập nhật metadata cuộc trò chuyện
   */
  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type?: string;
    attachments?: {
      url: string;
      type: string;
    }[];
  }) {
    try {
      // Chuyển logic tương tác DB vào Repository
      const message = await this.messageRepository.sendMessageTransaction(data);

      return {
        success: true,
        message: 'Message sent successfully',
        data: {
          id: message.id.toString(),
          conversation_id: message.conversation_id.toString(),
          content: message.content,
          type: message.type,
          created_at: message.created_at,
          sender: {
            id: message.users.id.toString(),
            username: message.users.username,
            name: message.users.name,
            avatar_url: message.users.avatar_url,
          },
          attachments: message.message_attachments.map((att) => ({
            id: att.id.toString(),
            url: att.url,
            type: att.file_type,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to send message',
        data: null,
      };
    }
  }

  /**
   * Lấy lịch sử tin nhắn
   */
  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit: number = 50,
  ) {
    // 1. Lấy last_seen_message_id từ repository
    const lastSeenMessageId = await this.participationRepo.getLastSeenMessageId(
      conversationId,
      userId,
    );

    // 2. Lấy danh sách tin nhắn từ repository
    const messages = await this.messageRepository.findByConversation(
      conversationId,
      cursor,
      limit,
    );

    const nextCursor =
      messages.length === limit
        ? messages[messages.length - 1].id.toString()
        : null;

    return {
      success: true,
      message: 'Get messages successfully',
      data: {
        items: (messages as any[]).map((m) => ({
          id: m.id.toString(),
          conversation_id: m.conversation_id.toString(),
          content: m.content,
          type: m.type,
          created_at: m.created_at,
          sender: {
            id: m.users.id.toString(),
            username: m.users.username,
            name: m.users.name,
            avatar_url: m.users.avatar_url,
          },
          attachments:
            m.message_attachments?.map((att) => ({
              id: att.id.toString(),
              url: att.url,
              type: att.file_type,
            })) || [],
          is_read: m.id <= lastSeenMessageId,
        })),
        nextCursor,
        hasMore: messages.length === limit,
      },
    };
  }

  /**
   * Lấy danh sách media (ảnh/video) của cuộc trò chuyện có phân trang
   */
  async getConversationMedia(
    conversationId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    const items = await this.messageRepository.getConversationMedia(
      conversationId,
      cursor,
      limit,
    );

    const hasMore = items.length > limit;
    let nextCursor: string | null = null;

    if (hasMore) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id.toString() || null;
    }

    return {
      success: true,
      message: 'Get conversation media successfully',
      data: {
        items: items.map((att) => ({
          id: att.id.toString(),
          url: att.url,
          file_type: att.file_type,
          width: att.width,
          height: att.height,
          file_size: att.file_size,
          created_at: att.messages.created_at,
          sender_id: att.messages.sender_id.toString(),
        })),
        nextCursor,
        hasMore,
      },
    };
  }

  /**
   * Tìm kiếm tin nhắn trong cuộc trò chuyện (Full-Text Search)
   */
  async searchMessages(
    conversationId: string,
    query: string,
    limit: number = 20,
    offset: number = 0,
  ) {
    if (!query) {
      return {
        success: true,
        message: 'Search query is empty',
        data: { items: [], total: 0 },
      };
    }

    const messages = (await this.messageRepository.searchMessages(
      conversationId,
      query,
      limit,
      offset,
    )) as any[];

    const total = messages.length > 0 ? Number(messages[0].full_count) : 0;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Search messages successfully',
      data: {
        items: messages.map((m) => ({
          id: m.id.toString(),
          conversation_id: m.conversation_id.toString(),
          content: m.content,
          type: m.type,
          created_at: m.created_at,
          sender: {
            id: m.sender_id.toString(),
            username: m.username,
            name: m.name,
            avatar_url: m.avatar_url,
          },
        })),
        pagination: {
          total: total,
          page: page,
          limit: limit,
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  /**
   * Lấy tin nhắn xung quanh một message_id (10 trước, 1) target, 10 sau)
   */
  async getMessagesAround(
    conversationId: string,
    messageId: string,
    userId: string,
    limit: number = 10,
  ) {
    const { target, before, after } =
      await this.messageRepository.getMessagesAround(
        conversationId,
        messageId,
        limit,
      );

    if (!target) {
      return {
        success: false,
        message: 'Target message not found',
        data: null,
      };
    }

    const lastSeenMessageId = await this.participationRepo.getLastSeenMessageId(
      conversationId,
      userId,
    );

    // Xác định hasMore cho hướng Trên (Cũ hơn) và Dưới (Mới hơn)
    const hasMoreAbove = before.length > limit; // "Trên" là phía tin nhắn cũ hơn (ID nhỏ hơn)
    const finalBefore = hasMoreAbove ? before.slice(1) : before;

    const hasMoreBelow = after.length > limit; // "Dưới" là phía tin nhắn mới hơn (ID lớn hơn)
    const finalAfter = hasMoreBelow ? after.slice(0, limit) : after;

    // Merge tin nhắn: [Mới nhất] -> [Target] -> [Cũ nhất]
    const allMessages = [
      ...[...finalAfter].reverse(),
      target,
      ...[...finalBefore].reverse(),
    ];

    return {
      success: true,
      message: 'Get messages around successfully',
      data: {
        items: allMessages.map((m) => ({
          id: m.id.toString(),
          conversation_id: m.conversation_id.toString(),
          content: m.content,
          type: m.type,
          created_at: m.created_at,
          sender: {
            id: m.users.id.toString(),
            username: m.users.username,
            name: m.users.name,
            avatar_url: m.users.avatar_url,
          },
          attachments:
            m.message_attachments?.map((att: any) => ({
              id: att.id.toString(),
              url: att.url,
              type: att.file_type,
            })) || [],
          is_read: m.id <= lastSeenMessageId,
        })),
        target_id: messageId,
        hasMoreAbove,
        hasMoreBelow,
      },
    };
  }

  /**
   * Lấy tin nhắn cũ hơn cursor (Load Older)
   */
  async getOlderMessages(
    conversationId: string,
    cursor: string,
    userId: string,
    limit: number = 20,
  ) {
    const messages = await this.messageRepository.getMessagesBefore(
      conversationId,
      cursor,
      limit,
    );
    const lastSeenMessageId = await this.participationRepo.getLastSeenMessageId(
      conversationId,
      userId,
    );

    return {
      success: true,
      message: 'Get older messages successfully',
      data: {
        items: messages.map((m) => ({
          id: m.id.toString(),
          conversation_id: m.conversation_id.toString(),
          content: m.content,
          type: m.type,
          created_at: m.created_at,
          sender: {
            id: m.users.id.toString(),
            username: m.users.username,
            name: m.users.name,
            avatar_url: m.users.avatar_url,
          },
          attachments:
            m.message_attachments?.map((att: any) => ({
              id: att.id.toString(),
              url: att.url,
              type: att.file_type,
            })) || [],
          is_read: m.id <= lastSeenMessageId,
        })),
        nextCursor:
          messages.length === limit
            ? messages[messages.length - 1].id.toString()
            : null,
        hasMore: messages.length === limit,
      },
    };
  }

  /**
   * Lấy tin nhắn mới hơn cursor (Load Newer)
   */
  async getNewerMessages(
    conversationId: string,
    cursor: string,
    userId: string,
    limit: number = 20,
  ) {
    const messages = await this.messageRepository.getMessagesAfter(
      conversationId,
      cursor,
      limit,
    );
    const lastSeenMessageId = await this.participationRepo.getLastSeenMessageId(
      conversationId,
      userId,
    );

    return {
      success: true,
      message: 'Get newer messages successfully',
      data: {
        items: [...messages].reverse().map((m) => ({
          id: m.id.toString(),
          conversation_id: m.conversation_id.toString(),
          content: m.content,
          type: m.type,
          created_at: m.created_at,
          sender: {
            id: m.users.id.toString(),
            username: m.users.username,
            name: m.users.name,
            avatar_url: m.users.avatar_url,
          },
          attachments:
            m.message_attachments?.map((att: any) => ({
              id: att.id.toString(),
              url: att.url,
              type: att.file_type,
            })) || [],
          is_read: m.id <= lastSeenMessageId,
        })),
        nextCursor:
          messages.length === limit
            ? messages[messages.length - 1].id.toString()
            : null,
        hasMore: messages.length === limit,
      },
    };
  }
}
