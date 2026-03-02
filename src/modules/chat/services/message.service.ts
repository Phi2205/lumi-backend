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
    const lastSeenMessageId = await this.participationRepo.getLastSeenMessageId(conversationId, userId);

    // 2. Lấy danh sách tin nhắn từ repository
    const messages = await this.messageRepository.findByConversation(
      conversationId,
      cursor,
      limit,
    );

    const nextCursor =
      messages.length === limit ? messages[messages.length - 1].id.toString() : null;

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
          attachments: m.message_attachments?.map((att) => ({
            id: att.id.toString(),
            url: att.url,
            type: att.file_type,
          })) || [],
          is_read: m.id <= lastSeenMessageId,
        })),
        nextCursor,
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
}
