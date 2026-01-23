import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { FriendRequestsRepository } from '../friend-requests/friend-requests.repository';
import { FriendsRepository } from '../friends/friends.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly friendRequestsRepository: FriendRequestsRepository,
    private readonly friendsRepository: FriendsRepository,
  ) {}

  // Tìm kiếm user theo name (chứa chuỗi, không phân biệt hoa/thường)
  async findByName(
    name?: string,
    page = 1,
    limit = 20,
  ) {
    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 1 : limit;
    const skip = (safePage - 1) * safeLimit;

    const { data, total } = await this.usersRepository.findByName(
      name,
      skip,
      safeLimit,
    );

    const serializedData = data.map((user) => ({
      ...user,
      id: user.id.toString(),
    }));

    return {
      success: true,
      message: 'Users fetched successfully',
      data: {
        users: serializedData,
        total,
        page: safePage,
        limit: safeLimit,
      },
    };
  }

  // Lấy user theo username (unique) với response chuẩn success/message/data
  async findByUsername(username: string, currentUserId?: string) {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }

    let friendStatus = 'none';

    // Nếu có currentUserId, kiểm tra friend request status
    if (currentUserId && currentUserId !== user.id.toString()) {
      // Kiểm tra đã là bạn chưa
      const areFriends = await this.friendsRepository.areFriends(
        currentUserId,
        user.id.toString(),
      );

      if (areFriends) {
        friendStatus = 'friend';
      } else {
        // Kiểm tra friend request: requester_id là mình, receiver_id là đối phương
        const friendRequest = await this.friendRequestsRepository.findFriendRequest(
          currentUserId,
          user.id.toString(),
        );

        if (friendRequest) {
          friendStatus = friendRequest.status; // 'pending', 'accepted', 'rejected'
        } else {
          // Kiểm tra friend request ngược lại: người kia gửi cho mình
          const reverseRequest = await this.friendRequestsRepository.findReverseFriendRequest(
            currentUserId,
            user.id.toString(),
          );

          if (reverseRequest) {
            // Nếu người kia gửi cho mình và đang pending → mình có thể accept
            if (reverseRequest.status === 'pending') {
              friendStatus = 'received_pending';
            } else {
              friendStatus = reverseRequest.status; // 'accepted', 'rejected'
            }
          }
        }
      }
    }

    return {
      success: true,
      message: 'User fetched successfully',
      data: {
        ...user,
        id: user.id.toString(),
        friend_status: friendStatus,
      },
    };
  }
}
