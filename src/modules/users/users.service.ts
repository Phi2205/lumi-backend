import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { FriendRequestsRepository } from '../friend-requests/friend-requests.repository';
import { FriendsRepository } from '../friends/friends.repository';
import { RecommendService } from '../recommend/recommend.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly friendRequestsRepository: FriendRequestsRepository,
    private readonly friendsRepository: FriendsRepository,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => RecommendService))
    private readonly recommendService: RecommendService,
  ) { }

  // Tìm kiếm user theo name (chứa chuỗi, không phân biệt hoa/thường)
  async findByName(name?: string, page = 1, limit = 20) {
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
  async findByUsername(
    username: string,
    currentUserId?: string,
    token?: string,
  ) {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }

    return {
      success: true,
      message: 'User fetched successfully',
      data: {
        ...user,
        id: user.id.toString(),
        friend_status: await this.getFriendStatus(
          currentUserId,
          user.id.toString(),
        ),
      },
    };
  }

  /**
   * Helper to compute friend status between two users
   */
  async getFriendStatus(
    currentUserId: string | undefined,
    targetUserId: string,
  ): Promise<string> {
    if (!currentUserId || currentUserId === targetUserId) {
      return 'none';
    }

    // Check if already friends
    const areFriends = await this.friendsRepository.areFriends(
      currentUserId,
      targetUserId,
    );

    if (areFriends) {
      return 'friend';
    }

    // Check if viewer sent a request
    const sentRequest = await this.friendRequestsRepository.findFriendRequest(
      currentUserId,
      targetUserId,
    );

    if (sentRequest) {
      return sentRequest.status; // 'pending', 'accepted', 'rejected'
    }

    // Check if viewer received a request
    const receivedRequest =
      await this.friendRequestsRepository.findReverseFriendRequest(
        currentUserId,
        targetUserId,
      );

    if (receivedRequest) {
      if (receivedRequest.status === 'pending') {
        return 'received_pending';
      }
      return receivedRequest.status; // 'accepted', 'rejected'
    }

    return 'none';
  }

  async findByIds(ids: string[]) {
    const users = await this.usersRepository.findByIds(ids);
    return users.map((u) => ({
      ...u,
      id: u.id.toString(),
    }));
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const updateData: any = {};
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.birthday !== undefined) {
      if (data.birthday) {
        const birthdayDate = new Date(data.birthday);
        const minDate = new Date('1900-01-01');

        if (isNaN(birthdayDate.getTime())) {
          throw new BadRequestException('Invalid birthday date');
        }

        if (birthdayDate < minDate) {
          throw new BadRequestException('Birthday must be after 1900-01-01');
        }
        updateData.birthday = birthdayDate;
      } else {
        updateData.birthday = null;
      }
    }

    const locationFields: (keyof UpdateProfileDto)[] = [
      'lat',
      'lng',
      'place_name',
      'address',
      'place_id',
    ];
    const hasLocationUpdate = locationFields.some(
      (field) => data[field] !== undefined,
    );

    if (hasLocationUpdate) {
      updateData.user_location = {};
      if (data.lat !== undefined)
        updateData.user_location.lat =
          data.lat !== null ? Number(data.lat) : null;
      if (data.lng !== undefined)
        updateData.user_location.lng =
          data.lng !== null ? Number(data.lng) : null;
      if (data.place_name !== undefined)
        updateData.user_location.place_name = data.place_name;
      if (data.address !== undefined)
        updateData.user_location.address = data.address;
      if (data.place_id !== undefined)
        updateData.user_location.place_id = data.place_id;
    }

    const updatedUser = await this.usersRepository.updateProfile(
      userId,
      updateData,
    );

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...updatedUser,
        id: updatedUser.id.toString(),
      },
    };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const updatedUser = await this.usersRepository.updateAvatar(
      userId,
      avatarUrl,
    );

    // Invalidate hover card cache
    const cacheKey = `user:hover_card:${userId}`;
    await this.redisService.del(cacheKey);

    return {
      success: true,
      message: 'Avatar updated successfully',
      data: {
        ...updatedUser,
        id: updatedUser.id.toString(),
      },
    };
  }

  async updateCoverImage(userId: string, coverImageUrl: string) {
    const updatedUser = await this.usersRepository.updateCoverImage(
      userId,
      coverImageUrl,
    );

    return {
      success: true,
      message: 'Cover image updated successfully',
      data: {
        ...updatedUser,
        id: updatedUser.id.toString(),
      },
    };
  }

  async getHoverCard(userId: string, currentUserId: string) {
    const cacheKey = `user:hover_card:${userId}`;
    const cachedData = await this.redisService.get(cacheKey);

    let baseData;
    if (cachedData) {
      baseData = JSON.parse(cachedData);
    } else {
      const user = await this.usersRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          data: null,
        };
      }

      const friendCount = await this.friendsRepository.countFriends(user.id);

      baseData = {
        id: user.id.toString(),
        name: user.name,
        username: user.username,
        avatar_url: user.avatar_url,
        address: user.user_location?.address || null,
        friend_count: friendCount,
      };

      await this.redisService.set(cacheKey, JSON.stringify(baseData), 3600);
    }

    // Always get the latest friend status for the specific viewer
    const friendStatus = await this.getFriendStatus(currentUserId, userId);
    console.log(friendStatus);
    return {
      success: true,
      message: cachedData
        ? 'Hover card fetched from cache'
        : 'Hover card fetched successfully',
      data: {
        ...baseData,
        friend_status: friendStatus,
      },
    };
  }
}
