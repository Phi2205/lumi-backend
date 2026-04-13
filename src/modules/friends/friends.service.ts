import { Injectable, NotFoundException } from '@nestjs/common';
import { FriendsRepository } from './friends.repository';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(
    private friendsRepository: FriendsRepository,
    private prisma: PrismaService,
  ) { }

  /**
   * Lấy danh sách bạn bè
   */
  async getFriendsList(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const friends = await this.friendsRepository.getFriendsList(
      userId,
      skip,
      limit,
    );
    const total = await this.friendsRepository.countFriends(userId);

    return {
      success: true,
      data: friends.map((f) => ({
        id: f.friend.id.toString(),
        username: f.friend.username,
        name: f.friend.name,
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
    const friendship = await this.friendsRepository.getFriendship(
      userId,
      friendId,
    );

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    return {
      success: true,
      data: {
        id: friendship.friend.id.toString(),
        username: friendship.friend.username,
        name: friendship.friend.name,
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
    const areFriends = await this.friendsRepository.areFriends(
      userId,
      friendId,
    );

    if (!areFriends) {
      throw new NotFoundException('You are not friends with this user');
    }

    // Xóa friendship (2 chiều)
    await this.friendsRepository.deleteFriendship(userId, friendId);

    // Xóa friend requests nếu có
    await Promise.all([
      this.prisma.friend_requests
        .deleteMany({
          where: {
            requester_id: BigInt(userId),
            receiver_id: BigInt(friendId),
          },
        })
        .catch(() => null),
      this.prisma.friend_requests
        .deleteMany({
          where: {
            requester_id: BigInt(friendId),
            receiver_id: BigInt(userId),
          },
        })
        .catch(() => null),
    ]);

    return {
      success: true,
      message: 'Unfriended successfully',
      status: 'none',
    };
  }
  /**
   * Lấy danh sách ID bạn bè
   */
  async getFriendIds(userId: string) {
    return this.friendsRepository.getFriendIds(userId);
  }

  /**
   * Lấy danh sách bạn chung
   */
  async getMutualFriends(userId: string, targetId: string) {
    const mutualFriends = await this.friendsRepository.getMutualFriends(
      userId,
      targetId,
    );

    return {
      success: true,
      data: mutualFriends.map((user) => ({
        id: user.id.toString(),
        username: user.username,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        bio: user.bio,
      })),
    };
  }

  /**
   * Lấy danh sách bạn bè của một user bất kỳ
   */
  async getFriendsOfUser(
    viewerId: string,
    targetId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // Nếu viewer xem danh sách của chính mình, gọi hàm cũ cho nhanh
    if (viewerId === targetId) {
      return this.getFriendsList(targetId, page, limit);
    }

    const friends = await this.friendsRepository.getFriendsWithMutualPriority(
      viewerId,
      targetId,
      skip,
      limit,
    );
    const total = await this.friendsRepository.countFriends(targetId);

    return {
      success: true,
      data: friends,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Đếm số lượng bạn bè và bạn chung
   */
  async getFriendsAndMutualCount(viewerId: string, targetId: string) {
    const [totalFriends, mutualFriends] = await Promise.all([
      this.friendsRepository.countFriends(targetId),
      this.friendsRepository.countMutualFriends(viewerId, targetId),
    ]);

    return {
      success: true,
      data: {
        total_friends: totalFriends,
        mutual_friends: mutualFriends,
      },
    };
  }

  /**
   * Tìm kiếm bạn bè của một user cụ thể
   */
  async searchFriendsOfUser(
    userId: string,
    query: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const { data, total } = await this.friendsRepository.searchFriendsOfUser(
      userId,
      query,
      limit,
      skip,
    );

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}
