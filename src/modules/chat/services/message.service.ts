import { Injectable } from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(
    private messageRepository: MessageRepository,
    private prisma: PrismaService,
  ) {}

  /**
   * Gửi tin nhắn và cập nhật metadata cuộc trò chuyện
   */
  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    content: string;
    type?: string;
  }) {
    const { conversationId, senderId, content, type } = data;
    const conversationIdBigInt = BigInt(conversationId);
    const senderIdBigInt = BigInt(senderId);

    // Sử dụng transaction để đảm bảo tính nhất quán
    const message = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo tin nhắn mới
      const newMessage = await tx.messages.create({
        data: {
          conversation_id: conversationIdBigInt,
          sender_id: senderIdBigInt,
          content: content,
          type: (type as any) || 'text',
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar_url: true,
            },
          },
        },
      });

      // 2. Cập nhật metadata cho conversation
      await tx.conversations.update({
        where: { id: conversationIdBigInt },
        data: {
          last_message: content,
          last_sender_id: senderIdBigInt,
          last_message_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 3. Tăng unread_count cho tất cả người tham gia trừ người gửi
      await tx.conversation_participants.updateMany({
        where: {
          conversation_id: conversationIdBigInt,
          user_id: { not: senderIdBigInt },
        },
        data: {
          unread_count: { increment: 1 },
        },
      });

      return newMessage;
    });

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
      },
    };
  }

  /**
   * Lấy lịch sử tin nhắn
   */
  async getMessages(conversationId: string, cursor?: string, limit: number = 50) {
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
        })),
        nextCursor,
      },
    };
  }
}
