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
      },
      orderBy: { updated_at: 'desc' },
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

  /**
   * Lấy chi tiết một conversation
   */
  async findById(conversationId: bigint | string) {
    return this.prisma.conversations.findUnique({
      where: {
        id: BigInt(conversationId),
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
      },
    });
  }

  /**
   * Tìm conversation riêng tư giữa 2 người
   */
  async findPrivateConversation(userId1: string, userId2: string) {
    const userId1BigInt = BigInt(userId1);
    const userId2BigInt = BigInt(userId2);

    return this.prisma.conversations.findFirst({
      where: {
        type: 'private',
        AND: [
          {
            conversation_participants: {
              some: { user_id: userId1BigInt },
            },
          },
          {
            conversation_participants: {
              some: { user_id: userId2BigInt },
            },
          },
        ],
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
      },
    });
  }

  /**
   * Tạo conversation riêng tư mới
   */
  async createPrivateConversation(userId1: string, userId2: string) {
    const userId1BigInt = BigInt(userId1);
    const userId2BigInt = BigInt(userId2);

    return this.prisma.conversations.create({
      data: {
        type: 'private',
        conversation_participants: {
          create: [
            { user_id: userId1BigInt },
            { user_id: userId2BigInt },
          ],
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
      },
    });
  }
}
