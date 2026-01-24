import { Controller, Get, Delete, UseGuards, Request, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  /**
   * Lấy danh sách bạn bè
   * GET /friends?page=1&limit=20
   */
  @Get()
  async getFriendsList(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.friendsService.getFriendsList(userId, pageNum, limitNum);
  }

  /**
   * Lấy thông tin một friendship
   * GET /friends/:friendId
   */
  @Get(':friendId')
  async getFriendship(@Request() req: any, @Param('friendId') friendId: string) {
    const userId = req.user.userId;
    return this.friendsService.getFriendship(userId, friendId);
  }

  /**
   * Đếm số bạn bè
   * GET /friends/count
   */
  @Get('count')
  async getFriendsCount(@Request() req: any) {
    const userId = req.user.userId;
    return this.friendsService.getFriendsCount(userId);
  }

  /**
   * Hủy kết bạn
   * FRIEND → unfriend → NONE
   * DELETE /friends/:friendId
   */
  @Delete(':friendId')
  async unfriend(@Request() req: any, @Param('friendId') friendId: string) {
    const userId = req.user.userId;
    return this.friendsService.unfriend(userId, friendId);
  }
}
