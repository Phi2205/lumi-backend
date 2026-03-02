import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessageRepository {
  constructor(private prisma: PrismaService) { }

  /**
   * Tạo tin nhắn mới
   */
  async create(data: {
    conversationId: string;
    senderId: string;
    content: string;
    type?: string;
    attachments?: { url: string; type: string }[];
  }) {
    return this.prisma.messages.create({
      data: {
        conversation_id: BigInt(data.conversationId),
        sender_id: BigInt(data.senderId),
        content: data.content,
        type: (data.type as any) || 'text',
        message_attachments: data.attachments?.length
          ? {
            create: data.attachments.map((att) => ({
              url: att.url,
              file_type: att.type,
            })),
          }
          : undefined,
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
        message_attachments: true,
      },
    });
  }

  /**
   * Lấy tin nhắn theo conversation (phân trang theo cursor hoặc offset)
   */
  async findByConversation(
    conversationId: string,
    cursor?: string,
    limit: number = 50,
  ) {
    return this.prisma.messages.findMany({
      where: {
        conversation_id: BigInt(conversationId),
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
        message_attachments: true,
      },
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursor
        ? {
          cursor: { id: BigInt(cursor) },
          skip: 1,
        }
        : {}),
    });
  }

  /**
   * Gửi tin nhắn và cập nhật metadata cuộc trò chuyện trong một transaction
   */
  async sendMessageTransaction(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type?: string;
    attachments?: { url: string; type: string }[];
  }) {
    const { conversationId, senderId, content, type, attachments } = data;
    const conversationIdBigInt = BigInt(conversationId);
    const senderIdBigInt = BigInt(senderId);

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Tạo tin nhắn mới
        const newMessage = await tx.messages.create({
          data: {
            conversation_id: conversationIdBigInt,
            sender_id: senderIdBigInt,
            content: content || '',
            type: (type as any) || (attachments?.length ? attachments[0].type : 'text'),
            message_attachments: attachments?.length
              ? {
                create: attachments.map((att) => ({
                  url: att.url,
                  file_type: att.type,
                })),
              }
              : undefined,
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
            message_attachments: true,
          },
        });

        // 2. Cập nhật metadata cho conversation
        await tx.conversations.update({
          where: { id: conversationIdBigInt },
          data: {
            last_message: content || (attachments?.length ? `[${attachments[0].type}]` : ''),
            last_message_id: newMessage.id,
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
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  /**
   * Lấy danh sách media (ảnh/video) của cuộc trò chuyện
   */
  async getConversationMedia(
    conversationId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    return this.prisma.message_attachments.findMany({
      take: limit + 1,
      where: {
        messages: {
          conversation_id: BigInt(conversationId),
        },
        file_type: {
          in: ['image', 'video'],
        },
      },
      cursor: cursor ? { id: BigInt(cursor) } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { id: 'desc' },
      include: {
        messages: {
          select: {
            created_at: true,
            sender_id: true,
          },
        },
      },
    });
  }
}
