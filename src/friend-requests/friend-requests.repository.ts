import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FriendRequestStatus } from '@prisma/client';

@Injectable()
export class FriendRequestsRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Tìm friend request giữa 2 users
   */
  async findFriendRequest(requesterId: bigint | string, receiverId: bigint | string) {
    return this.prisma.friend_requests.findUnique({
      where: {
        requester_id_receiver_id: {
          requester_id: BigInt(requesterId),
          receiver_id: BigInt(receiverId),
        },
      },
    });
  }

  /**
   * Tìm friend request theo chiều ngược lại (B → A)
   */
  async findReverseFriendRequest(requesterId: bigint | string, receiverId: bigint | string) {
    return this.prisma.friend_requests.findUnique({
      where: {
        requester_id_receiver_id: {
          requester_id: BigInt(receiverId),
          receiver_id: BigInt(requesterId),
        },
      },
    });
  }

  /**
   * Tạo friend request mới
   */
  async createFriendRequest(requesterId: bigint | string, receiverId: bigint | string) {
    return this.prisma.friend_requests.create({
      data: {
        requester_id: BigInt(requesterId),
        receiver_id: BigInt(receiverId),
      },
    });
  }

  /**
   * Cập nhật status của friend request
   */
  async updateFriendRequestStatus(
    requesterId: bigint | string,
    receiverId: bigint | string,
    status: FriendRequestStatus,
  ) {
    return this.prisma.friend_requests.update({
      where: {
        requester_id_receiver_id: {
          requester_id: BigInt(requesterId),
          receiver_id: BigInt(receiverId),
        },
      },
      data: {
        status,
        responded_at: new Date(),
      },
    });
  }

  /**
   * Reset friend request về pending (dùng cho resend)
   * Update created_at để biết thời điểm resend mới nhất
   */
  async resetFriendRequestToPending(
    requesterId: bigint | string,
    receiverId: bigint | string,
  ) {
    return this.prisma.friend_requests.update({
      where: {
        requester_id_receiver_id: {
          requester_id: BigInt(requesterId),
          receiver_id: BigInt(receiverId),
        },
      },
      data: {
        status: FriendRequestStatus.pending,
        responded_at: null,
        created_at: new Date(), // Update thời điểm resend mới nhất
      },
    });
  }

  /**
   * Xóa friend request
   */
  async deleteFriendRequest(requesterId: bigint | string, receiverId: bigint | string) {
    return this.prisma.friend_requests.delete({
      where: {
        requester_id_receiver_id: {
          requester_id: BigInt(requesterId),
          receiver_id: BigInt(receiverId),
        },
      },
    });
  }

}
