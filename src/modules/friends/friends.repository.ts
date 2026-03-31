import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FriendsRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Kiểm tra 2 users đã là bạn chưa
   */
  async areFriends(userId: bigint | string, friendId: bigint | string) {
    const friendship = await this.prisma.friends.findUnique({
      where: {
        user_id_friend_id: {
          user_id: BigInt(userId),
          friend_id: BigInt(friendId),
        },
      },
    });
    return !!friendship;
  }

  /**
   * Tạo friendship (2 chiều: A-B và B-A)
   */
  async createFriendship(userId: bigint | string, friendId: bigint | string) {
    // Tạo 2 records: A-B và B-A
    await this.prisma.friends.createMany({
      data: [
        {
          user_id: BigInt(userId),
          friend_id: BigInt(friendId),
        },
        {
          user_id: BigInt(friendId),
          friend_id: BigInt(userId),
        },
      ],
      skipDuplicates: true,
    });
  }

  /**
   * Xóa friendship (xóa cả 2 chiều)
   */
  async deleteFriendship(userId: bigint | string, friendId: bigint | string) {
    await Promise.all([
      this.prisma.friends.deleteMany({
        where: {
          user_id: BigInt(userId),
          friend_id: BigInt(friendId),
        },
      }),
      this.prisma.friends.deleteMany({
        where: {
          user_id: BigInt(friendId),
          friend_id: BigInt(userId),
        },
      }),
    ]);
  }

  /**
   * Lấy danh sách bạn bè của một user
   */
  async getFriendsList(userId: bigint | string, skip?: number, take?: number) {
    return this.prisma.friends.findMany({
      where: {
        user_id: BigInt(userId),
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            avatar_url: true,
            bio: true,
            user_location: true,
            birthday: true,
          },
        },
      },
      skip,
      take,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Đếm số bạn bè của một user
   */
  async countFriends(userId: bigint | string) {
    return this.prisma.friends.count({
      where: {
        user_id: BigInt(userId),
      },
    });
  }

  /**
   * Lấy thông tin friendship giữa 2 users
   */
  async getFriendship(userId: bigint | string, friendId: bigint | string) {
    return this.prisma.friends.findUnique({
      where: {
        user_id_friend_id: {
          user_id: BigInt(userId),
          friend_id: BigInt(friendId),
        },
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            avatar_url: true,
            bio: true,
            user_location: true,
            birthday: true,
          },
        },
      },
    });
  }
  async getFriendIds(userId: bigint | string) {
    const friends = await this.prisma.friends.findMany({
      where: {
        user_id: BigInt(userId),
      },
      select: {
        friend_id: true,
      },
    });
    return friends.map((f) => f.friend_id);
  }

  /**
   * Lấy danh sách bạn chung của 2 users
   */
  async getMutualFriends(userIdA: bigint | string, userIdB: bigint | string) {
    const aId = BigInt(userIdA);
    const bId = BigInt(userIdB);

    return this.prisma.users.findMany({
      where: {
        AND: [
          {
            friends_friend: {
              some: { user_id: aId },
            },
          },
          {
            friends_friend: {
              some: { user_id: bId },
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar_url: true,
        bio: true,
        user_location: true,
        birthday: true,
      },
    });
  }

  /**
   * Lấy danh sách bạn bè của targetId, ưu tiên bạn chung với viewerId
   */
  async getFriendsWithMutualPriority(
    viewerId: string,
    targetId: string,
    skip: number,
    take: number,
  ) {
    const viewerBigInt = BigInt(viewerId);
    const targetBigInt = BigInt(targetId);

    // Truy vấn lấy danh sách bạn của targetId, kèm theo việc đánh dấu bạn chung với viewerId
    // Kết quả trả về là mảng các đối tượng, cần ánh xạ lại một chút
    const result: any[] = await this.prisma.$queryRaw`
      SELECT 
        u.id, u.username, u.name, u.avatar_url, u.bio,
        f.created_at as "friends_since",
        EXISTS (
          SELECT 1 FROM friends f2 
          WHERE f2.user_id = ${viewerBigInt} AND f2.friend_id = f.friend_id
        ) as "is_mutual"
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ${targetBigInt}
      ORDER BY "is_mutual" DESC, f.created_at DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    return result.map((item) => ({
      ...item,
      id: item.id.toString(),
      is_mutual: Boolean(item.is_mutual),
    }));
  }

  /**
   * Đếm số lượng bạn chung giữa 2 users
   */
  async countMutualFriends(userIdA: bigint | string, userIdB: bigint | string) {
    const aId = BigInt(userIdA);
    const bId = BigInt(userIdB);

    return this.prisma.users.count({
      where: {
        AND: [
          {
            friends_friend: {
              some: { user_id: aId },
            },
          },
          {
            friends_friend: {
              some: { user_id: bId },
            },
          },
        ],
      },
    });
  }
}
