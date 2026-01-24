import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FriendRequestsRepository } from './friend-requests.repository';
import { FriendsRepository } from 'src/friends/friends.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { FriendRequestStatus } from '@prisma/client';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { parsePaginationParams, createPaginationResponse } from 'src/utils/pagination';

@Injectable()
export class FriendRequestsService {
  constructor(
    private friendRequestsRepository: FriendRequestsRepository,
    private friendsRepository: FriendsRepository,
    private prisma: PrismaService,
  ) {}

  /**
   * Lấy danh sách lời mời kết bạn đã nhận với phân trang
   */
  async getFriendRequestsByReceiver(
    receiverId: string,
    page?: string | number,
    limit?: string | number,
  ) {
    const { page: pageNumber, limit: limitNumber, offset } = parsePaginationParams(page, limit);

    const { data, total } = await this.friendRequestsRepository.getFriendRequestsByReceiver(
      receiverId,
      limitNumber,
      offset,
    );

    // Serialize data: convert BigInt to string và format response
    const serializedData = data.map((request) => ({
      requester_id: request.requester_id.toString(),
      receiver_id: request.receiver_id.toString(),
      status: request.status,
      created_at: request.created_at,
      responded_at: request.responded_at,
      requester: {
        id: request.requester.id.toString(),
        name: request.requester.name,
        username: request.requester.username,
        email: request.requester.email,
        avatar_url: request.requester.avatar_url,
        bio: request.requester.bio,
      },
    }));

    const paginated = createPaginationResponse(serializedData, pageNumber, limitNumber, total);

    return {
      success: true,
      message: 'Friend requests fetched successfully',
      data: {
        items: paginated.data,
        pagination: paginated.pagination,
      },
    };
  }

  /**
   * Gửi lời mời kết bạn
   * NONE → send → PENDING
   * REJECTED → resend (after cooldown) → PENDING
   * Nếu cả A→B và B→A đều PENDING → tự động accept (FRIEND)
   */
  async sendFriendRequest(requesterId: string, dto: SendFriendRequestDto) {
    const requesterIdBigInt = BigInt(requesterId);
    const receiverIdBigInt = BigInt(dto.receiver_id);

    // Kiểm tra không được gửi request cho chính mình
    if (requesterIdBigInt === receiverIdBigInt) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Kiểm tra đã là bạn chưa
    const alreadyFriends = await this.friendsRepository.areFriends(
      requesterId,
      dto.receiver_id,
    );
    if (alreadyFriends) {
      throw new ConflictException('You are already friends with this user');
    }

    // Kiểm tra đã có request từ A → B chưa
    const existingRequest = await this.friendRequestsRepository.findFriendRequest(
      requesterId,
      dto.receiver_id,
    );
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        throw new ConflictException('Friend request already sent');
      }
      if (existingRequest.status === 'rejected') {
        // REJECTED → resend (after cooldown) → PENDING
        // Kiểm tra cooldown (24 giờ)
        if (existingRequest.responded_at) {
          const cooldownHours = 24;
          const cooldownMs = cooldownHours * 60 * 60 * 1000;
          const timeSinceRejection = Date.now() - existingRequest.responded_at.getTime();

          if (timeSinceRejection < cooldownMs) {
            const remainingHours = Math.ceil((cooldownMs - timeSinceRejection) / (60 * 60 * 1000));
            throw new BadRequestException(
              `Please wait ${remainingHours} more hour(s) before resending the friend request.`,
            );
          }
        }

        // Update lại request cũ về pending (resend)
        const updatedRequest = await this.friendRequestsRepository.resetFriendRequestToPending(
          requesterId,
          dto.receiver_id,
        );

        return {
          success: true,
          message: 'Friend request resent successfully',
          friend_request: {
            requester_id: updatedRequest.requester_id.toString(),
            receiver_id: updatedRequest.receiver_id.toString(),
            status: updatedRequest.status,
            created_at: updatedRequest.created_at,
          },
        };
      }
      if (existingRequest.status === 'accepted') {
        throw new ConflictException('You are already friends with this user');
      }
    }

    // Kiểm tra đã có request từ B → A chưa
    const reverseRequest = await this.friendRequestsRepository.findReverseFriendRequest(
      requesterId,
      dto.receiver_id,
    );

    // LOGIC ĐẶC BIỆT: Nếu B đã gửi request cho A (PENDING), thì A gửi cho B = accept
    if (reverseRequest && reverseRequest.status === 'pending') {
      // Tự động accept cả 2 requests và tạo friendship
      await Promise.all([
        this.friendRequestsRepository.updateFriendRequestStatus(
          dto.receiver_id,
          requesterId,
          'accepted',
        ),
        this.friendRequestsRepository.createFriendRequest(requesterId, dto.receiver_id),
      ]);

      // Tạo friendship (2 chiều)
      await this.friendsRepository.createFriendship(requesterId, dto.receiver_id);

      // Cập nhật request A→B thành accepted
      await this.friendRequestsRepository.updateFriendRequestStatus(
        requesterId,
        dto.receiver_id,
        'accepted',
      );

      return {
        success: true,
        message: 'Friend request accepted automatically (mutual request)',
        status: 'friend',
      };
    }

    if (reverseRequest && reverseRequest.status === 'accepted') {
      throw new ConflictException('You are already friends with this user');
    }

    // Tạo friend request mới (PENDING)
    const friendRequest = await this.friendRequestsRepository.createFriendRequest(
      requesterId,
      dto.receiver_id,
    );

    return {
      success: true,
      message: 'Friend request sent successfully',
      friend_request: {
        requester_id: friendRequest.requester_id.toString(),
        receiver_id: friendRequest.receiver_id.toString(),
        status: friendRequest.status,
        created_at: friendRequest.created_at,
      },
    };
  }

  /**
   * Chấp nhận lời mời kết bạn
   * PENDING → accept → FRIEND
   */
  async acceptFriendRequest(receiverId: string, dto: RespondFriendRequestDto) {
    const request = await this.friendRequestsRepository.findFriendRequest(
      dto.requester_id,
      receiverId,
    );

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Friend request is already ${request.status}`);
    }

    const requesterIdBigInt = BigInt(dto.requester_id);
    const receiverIdBigInt = BigInt(receiverId);

    // Sử dụng transaction để đảm bảo tính atomic
    await this.prisma.$transaction(async (tx) => {
      // Cập nhật status thành accepted
      await tx.friend_requests.update({
        where: {
          requester_id_receiver_id: {
            requester_id: requesterIdBigInt,
            receiver_id: receiverIdBigInt,
          },
        },
        data: {
          status: FriendRequestStatus.accepted,
          responded_at: new Date(),
        },
      });

      // Tạo friendship (2 chiều)
      await tx.friends.createMany({
        data: [
          {
            user_id: requesterIdBigInt,
            friend_id: receiverIdBigInt,
          },
          {
            user_id: receiverIdBigInt,
            friend_id: requesterIdBigInt,
          },
        ],
        skipDuplicates: true,
      });
    });

    return {
      success: true,
      message: 'Friend request accepted',
      status: 'friend',
    };
  }

  /**
   * Từ chối lời mời kết bạn
   * PENDING → reject → REJECTED
   */
  async rejectFriendRequest(receiverId: string, dto: RespondFriendRequestDto) {
    const request = await this.friendRequestsRepository.findFriendRequest(
      dto.requester_id,
      receiverId,
    );

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Friend request is already ${request.status}`);
    }

    // Cập nhật status thành rejected
    await this.friendRequestsRepository.updateFriendRequestStatus(
      dto.requester_id,
      receiverId,
      'rejected',
    );

    return {
      success: true,
      message: 'Friend request rejected',
      status: 'rejected',
    };
  }

  /**
   * Hủy lời mời kết bạn đã gửi
   * PENDING → cancel → NONE
   */
  async cancelFriendRequest(requesterId: string, dto: SendFriendRequestDto) {
    const request = await this.friendRequestsRepository.findFriendRequest(
      requesterId,
      dto.receiver_id,
    );

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel friend request with status: ${request.status}`);
    }

    // Xóa friend request
    await this.friendRequestsRepository.deleteFriendRequest(requesterId, dto.receiver_id);

    return {
      success: true,
      message: 'Friend request cancelled',
      status: 'none',
    };
  }


}
