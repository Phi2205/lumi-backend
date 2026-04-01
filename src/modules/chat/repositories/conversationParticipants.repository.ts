import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConversationParticipantsRepository {
  constructor(private prisma: PrismaService) { }

  /**
   * Lấy danh sách conversations của user với phân trang
   * @param userId ID của người dùng
   * @param page Trang hiện tại
   * @param limit Số lượng bản ghi trên mỗi trang
   */
  async findByUserId(
    userId: string | bigint,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [items, total] = await Promise.all([
      this.prisma.conversation_participants.findMany({
        where: {
          user_id: BigInt(userId),
        },
        include: {
          conversation: {
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
          },
        },
        orderBy: {
          conversation: {
            updated_at: 'desc',
          },
        },
        skip: skip,
        take: take,
      }),
      this.prisma.conversation_participants.count({
        where: {
          user_id: BigInt(userId),
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item.conversation,
        unread_count: item.unread_count,
      })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Lấy danh sách participants của một conversation
   */
  async findByConversationId(conversationId: string | bigint) {
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
   * Kiểm tra xem một user có trong conversation không
   */
  async isParticipant(
    conversationId: string | bigint,
    userId: string | bigint,
  ) {
    const participant = await this.prisma.conversation_participants.findUnique({
      where: {
        conversation_id_user_id: {
          conversation_id: BigInt(conversationId),
          user_id: BigInt(userId),
        },
      },
    });
    return !!participant;
  }

  /**
   * Cập nhật tin nhắn cuối cùng đã xem và reset unread_count
   */
  async markAsRead(
    conversationId: string | bigint,
    userId: string | bigint,
    lastMessageId: string | bigint,
  ) {
    return this.prisma.conversation_participants.update({
      where: {
        conversation_id_user_id: {
          conversation_id: BigInt(conversationId),
          user_id: BigInt(userId),
        },
      },
      data: {
        last_seen_message_id: BigInt(lastMessageId),
        unread_count: 0,
      },
    });
  }

  /**
   * Lấy last_seen_message_id của người dùng trong cuộc hội thoại
   */
  async getLastSeenMessageId(
    conversationId: string | bigint,
    userId: string | bigint,
  ) {
    const participant = await this.prisma.conversation_participants.findUnique({
      where: {
        conversation_id_user_id: {
          conversation_id: BigInt(conversationId),
          user_id: BigInt(userId),
        },
      },
      select: {
        last_seen_message_id: true,
      },
    });

    return participant?.last_seen_message_id || BigInt(0);
  }

  /**
   * Tìm kiếm cuộc trò chuyện của user
   */
  async searchByUserId(
    userId: string | bigint,
    query: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const searchQuery = query.trim();

    const [items, total] = await Promise.all([
      this.prisma.conversation_participants.findMany({
        where: {
          user_id: BigInt(userId),
          conversation: {
            OR: [
              {
                name: {
                  contains: searchQuery,
                  mode: 'insensitive',
                },
              },
              {
                conversation_participants: {
                  some: {
                    user_id: {
                      not: BigInt(userId),
                    },
                    users: {
                      OR: [
                        { name: { contains: searchQuery, mode: 'insensitive' } },
                        { username: { contains: searchQuery, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
        include: {
          conversation: {
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
          },
        },
        orderBy: {
          conversation: {
            updated_at: 'desc',
          },
        },
        skip: skip,
        take: take,
      }),
      this.prisma.conversation_participants.count({
        where: {
          user_id: BigInt(userId),
          conversation: {
            OR: [
              {
                name: {
                  contains: searchQuery,
                  mode: 'insensitive',
                },
              },
              {
                conversation_participants: {
                  some: {
                    user_id: {
                      not: BigInt(userId),
                    },
                    users: {
                      OR: [
                        { name: { contains: searchQuery, mode: 'insensitive' } },
                        { username: { contains: searchQuery, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item.conversation,
        unread_count: item.unread_count,
      })),
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
