import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { FriendRequestsRepository } from '../friend-requests/friend-requests.repository';
import { FriendsRepository } from '../friends/friends.repository';
import { RecommendService } from '../recommend/recommend.service';
import { UpdateProfileDto } from './dto/update-profile.dto';


@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly friendRequestsRepository: FriendRequestsRepository,
    private readonly friendsRepository: FriendsRepository,
    private readonly recommendService: RecommendService,
  ) { }

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
  async findByUsername(username: string, currentUserId?: string, token?: string) {
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
    // console.log('Logging event to Recommend service:', {
    //   actor_user_id: currentUserId,
    //   target_user_id: user.id.toString(),
    //   event_type: 'view_profile',
    // });
    // if (currentUserId && currentUserId !== user.id.toString()) {
    //   this.recommendService
    //     .logEvent({
    //       actor_user_id: currentUserId,
    //       target_user_id: user.id.toString(),
    //       event_type: 'view_profile',
    //       timestamp: new Date().toISOString(),
    //       session_id: token,
    //     })
    //     .catch(err => {
    //       console.error('[Recommend] logEvent failed', err);
    //     });
    // }
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

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const updateData: any = {};
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.birthday !== undefined) {
      updateData.birthday = data.birthday ? new Date(data.birthday) : null;
    }

    const locationFields: (keyof UpdateProfileDto)[] = ['lat', 'lng', 'place_name', 'address', 'place_id'];
    const hasLocationUpdate = locationFields.some(field => data[field] !== undefined);

    if (hasLocationUpdate) {
      updateData.user_location = {};
      if (data.lat !== undefined) updateData.user_location.lat = data.lat !== null ? Number(data.lat) : null;
      if (data.lng !== undefined) updateData.user_location.lng = data.lng !== null ? Number(data.lng) : null;
      if (data.place_name !== undefined) updateData.user_location.place_name = data.place_name;
      if (data.address !== undefined) updateData.user_location.address = data.address;
      if (data.place_id !== undefined) updateData.user_location.place_id = data.place_id;
    }

    const updatedUser = await this.usersRepository.updateProfile(userId, updateData);

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...updatedUser,
        id: updatedUser.id.toString(),
      },
    };
  }
}
