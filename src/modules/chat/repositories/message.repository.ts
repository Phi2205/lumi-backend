import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessageRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo tin nhắn mới
   */
  async create(data: {
    conversationId: string;
    senderId: string;
    content: string;
    type?: string;
  }) {
    return this.prisma.messages.create({
      data: {
        conversation_id: BigInt(data.conversationId),
        sender_id: BigInt(data.senderId),
        content: data.content,
        type: (data.type as any) || 'text',
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
}
