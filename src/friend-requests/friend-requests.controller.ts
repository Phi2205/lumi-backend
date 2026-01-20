import { Controller, Post, Put, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendRequestsService } from './friend-requests.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';

@Controller('friend-requests')
@UseGuards(AuthGuard('jwt'))
export class FriendRequestsController {
  constructor(private friendRequestsService: FriendRequestsService) {}

  /**
   * Gửi lời mời kết bạn
   * NONE → send → PENDING
   * POST /friend-requests
   */
  @Post()
  async sendFriendRequest(@Request() req: any, @Body() dto: SendFriendRequestDto) {
    const requesterId = req.user.userId; // Lấy từ JWT token
    return this.friendRequestsService.sendFriendRequest(requesterId, dto);
  }

  /**
   * Chấp nhận lời mời kết bạn
   * PENDING → accept → FRIEND
   * PUT /friend-requests/accept
   */
  @Put('accept')
  async acceptFriendRequest(@Request() req: any, @Body() dto: RespondFriendRequestDto) {
    const receiverId = req.user.userId;
    return this.friendRequestsService.acceptFriendRequest(receiverId, dto);
  }

  /**
   * Từ chối lời mời kết bạn
   * PENDING → reject → REJECTED
   * PUT /friend-requests/reject
   */
  @Put('reject')
  async rejectFriendRequest(@Request() req: any, @Body() dto: RespondFriendRequestDto) {
    const receiverId = req.user.userId;
    return this.friendRequestsService.rejectFriendRequest(receiverId, dto);
  }

  /**
   * Hủy lời mời kết bạn đã gửi
   * PENDING → cancel → NONE
   * DELETE /friend-requests
   */
  @Delete()
  async cancelFriendRequest(@Request() req: any, @Body() dto: SendFriendRequestDto) {
    const requesterId = req.user.userId;
    return this.friendRequestsService.cancelFriendRequest(requesterId, dto);
  }

}
