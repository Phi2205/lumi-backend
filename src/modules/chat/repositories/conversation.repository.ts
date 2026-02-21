import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConversationRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy tất cả conversations mà user tham gia
   */
  async getUserConversations(userId: bigint | string) {
    return this.prisma.conversations.findMany({
      where: {
        conversation_participants: {
          some: {
            user_id: BigInt(userId),
          },
        },
      },
      include: {
        conversation_participants: {
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
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Lấy danh sách participants của một conversation
   */
  async getParticipants(conversationId: bigint | string) {
    return this.prisma.conversation_participants.findMany({
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
    });
  }
}
