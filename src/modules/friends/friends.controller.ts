import { Controller, Get, Delete, UseGuards, Request, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
  constructor(private friendsService: FriendsService) { }

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
   * Lấy danh sách bạn bè của một user bất kỳ (Ưu tiên bạn chung)
   * GET /friends/user/:userId?page=1&limit=20
   */
  @Get('user/:userId')
  async getFriendsOfUser(
    @Request() req: any,
    @Param('userId') targetId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const viewerId = req.user.userId;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.friendsService.getFriendsOfUser(viewerId, targetId, pageNum, limitNum);
  }

  /**
   * Lấy danh sách bạn chung
   * GET /friends/mutual/:targetId
   */
  @Get('mutual/:targetId')
  async getMutualFriends(@Request() req: any, @Param('targetId') targetId: string) {
    const userId = req.user.userId;
    return this.friendsService.getMutualFriends(userId, targetId);
  }

  /**
   * Đếm số lượng bạn bè và bạn chung
   * GET /friends/count-with-mutual/:targetId
   */
  @Get('count-with-mutual/:targetId')
  async getFriendsAndMutualCount(@Request() req: any, @Param('targetId') targetId: string) {
    const viewerId = req.user.userId;
    return this.friendsService.getFriendsAndMutualCount(viewerId, targetId);
  }

  /**
   * Đếm số bạn bè của chính mình
   * GET /friends/count
   */
  @Get('count')
  async getFriendsCount(@Request() req: any) {
    const userId = req.user.userId;
    return this.friendsService.getFriendsCount(userId);
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
