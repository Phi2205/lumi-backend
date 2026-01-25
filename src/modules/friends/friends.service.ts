import { Injectable, NotFoundException } from '@nestjs/common';
import { FriendsRepository } from './friends.repository';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(
    private friendsRepository: FriendsRepository,
    private prisma: PrismaService,
  ) {}

  /**
   * Lấy danh sách bạn bè
   */
  async getFriendsList(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const friends = await this.friendsRepository.getFriendsList(userId, skip, limit);
    const total = await this.friendsRepository.countFriends(userId);

    return {
      success: true,
      data: friends.map((f) => ({
        id: f.friend.id.toString(),
        username: f.friend.username,
        email: f.friend.email,
        avatar_url: f.friend.avatar_url,
        bio: f.friend.bio,
        friends_since: f.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy thông tin một friendship
   */
  async getFriendship(userId: string, friendId: string) {
    const friendship = await this.friendsRepository.getFriendship(userId, friendId);

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    return {
      success: true,
      data: {
        id: friendship.friend.id.toString(),
        username: friendship.friend.username,
        email: friendship.friend.email,
        avatar_url: friendship.friend.avatar_url,
        bio: friendship.friend.bio,
        friends_since: friendship.created_at,
      },
    };
  }

  /**
   * Đếm số bạn bè
   */
  async getFriendsCount(userId: string) {
    const count = await this.friendsRepository.countFriends(userId);

    return {
      success: true,
      count,
    };
  }

  /**
   * Hủy kết bạn
   * FRIEND → unfriend → NONE
   */
  async unfriend(userId: string, friendId: string) {
    const areFriends = await this.friendsRepository.areFriends(userId, friendId);

    if (!areFriends) {
      throw new NotFoundException('You are not friends with this user');
    }

    // Xóa friendship (2 chiều)
    await this.friendsRepository.deleteFriendship(userId, friendId);

    // Xóa friend requests nếu có
    await Promise.all([
      this.prisma.friend_requests.deleteMany({
        where: {
          requester_id: BigInt(userId),
          receiver_id: BigInt(friendId),
        },
      }).catch(() => null),
      this.prisma.friend_requests.deleteMany({
        where: {
          requester_id: BigInt(friendId),
          receiver_id: BigInt(userId),
        },
      }).catch(() => null),
    ]);

    return {
      success: true,
      message: 'Unfriended successfully',
      status: 'none',
    };
  }
}
