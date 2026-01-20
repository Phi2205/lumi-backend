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
            email: true,
            avatar_url: true,
            bio: true,
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
            email: true,
            avatar_url: true,
            bio: true,
          },
        },
      },
    });
  }
}
