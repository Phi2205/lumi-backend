import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Query,
  Param,
  Delete,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SocketGateway } from 'src/modules/realtime/gateways/socket.gateway';
import { ReelCommentService } from '../services/reel-comment.service';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReelsService } from '../services/reels.service';
import { CreateReelDto } from '../dto/create-reel.dto';
import { ReelLikeService } from '../services/reel-like.service';
import { RecommendService } from 'src/modules/recommend/recommend.service';
import { ReelViewService } from '../services/reel-view.service';

@ApiTags('reels')
@Controller('reels')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ReelsController {
  constructor(
    private readonly reelsService: ReelsService,
    private readonly reelLikeService: ReelLikeService,
    private readonly reelCommentService: ReelCommentService,
    private readonly reelViewService: ReelViewService,
    @Inject(forwardRef(() => SocketGateway))
    private readonly socketGateway: SocketGateway,
    @Inject(forwardRef(() => RecommendService))
    private readonly recommendService: RecommendService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new reel' })
  @ApiConsumes('application/json')
  async createReel(@Body() dto: CreateReelDto, @Req() req: any) {
    const result = await this.reelsService.createReel(
      req.user.userId,
      dto.video_url,
      dto.public_id,
      dto,
    );

    return {
      success: true,
      message: 'Reel created successfully',
      data: result,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my reels with cursor pagination' })
  async getMyReels(
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId;
    const result = await this.reelsService.getUserReels(
      userId,
      cursor,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      message: 'My reels fetched successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get list of reels' })
  async getReels(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.reelsService.getReels(
      req.user.userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );

    return {
      success: true,
      message: 'Reels fetched successfully',
      data: result,
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user reels by userId with cursor pagination' })
  async getUserReels(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const viewerId = req.user.userId;
    const result = await this.reelsService.getUserReels(
      userId,
      cursor,
      limit ? parseInt(limit) : 10,
      viewerId,
    );

    return {
      success: true,
      message: 'User reels fetched successfully',
      data: result,
    };
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like a reel' })
  @ApiResponse({ status: 200, description: 'Reel liked/unliked successfully' })
  async toggleLike(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    const result = await this.reelLikeService.toggleLike(id, userId);

    // ─── Gửi event tương tác xuống hệ thống CF ───
    if (result.status === 'liked') {
      try {
        const reelResult = await this.reelsService.getReelById(id, userId);
        if (reelResult.success && reelResult.data) {
          const targetUserId = reelResult.data.user_id;

          if (targetUserId !== userId.toString()) {
            this.recommendService
              .logEvent({
                actor_user_id: userId,
                target_user_id: targetUserId,
                event_type: 'like_reel', // <--- Gọi like_reel ở hệ thống CF
                timestamp: new Date().toISOString(),
                content_id: id,
                metadata: {
                  source: 'reels_controller',
                },
              })
              .catch((err) =>
                console.error('Failed to log like_reel event to CF:', err.message),
              );
          }
        }
      } catch (error) {
        console.error('Error logging like interaction for reel:', error);
      }
    }

    return result;
  }

  @Post('seen')
  @ApiOperation({ summary: 'Mark multiple reels as seen/viewed' })
  @ApiResponse({ status: 200, description: 'Reels marked as seen' })
  async markAsSeen(@Body('reelIds') reelIds: string[], @Req() req: any) {
    const userId = req.user.userId;

    if (!reelIds || reelIds.length === 0) {
      return { success: true, message: 'No reel IDs provided' };
    }

    // 1. Lưu vào DB và Redis qua service
    const result = await this.reelViewService.markAsSeen(reelIds, userId);

    // Đồng bộ tức thì với queue recommend trong Redis
    this.recommendService.syncSeenReelsStatusInQueue(userId, reelIds).catch((err) =>
      console.error('Failed to sync seen reels status in queue:', err.message),
    );

    // 2. Log event view_reel cho từng reel để gửi sang hệ thống CF
    for (const id of reelIds) {
      try {
        const reelResult = await this.reelsService.getReelById(id, userId);
        if (reelResult.success && reelResult.data) {
          const targetUserId = reelResult.data.user_id;

          this.recommendService
            .logEvent({
              actor_user_id: userId,
              target_user_id: targetUserId,
              event_type: 'view_reel',
              timestamp: new Date().toISOString(),
              content_id: id,
              metadata: {
                source: 'reels_controller',
              },
            })
            .catch((err) =>
              console.error(`Failed to log view_reel event for ${id} to CF:`, err.message),
            );
        }
      } catch (error) {
        console.error(`Error processing view event for reel ${id}:`, error);
      }
    }

    return result;
  }

  @Get(':id/likes')
  @ApiOperation({ summary: 'Get all likes for a reel' })
  @ApiResponse({ status: 200, description: 'List of users who liked the reel' })
  async getLikesByReelId(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reelLikeService.getLikesByReelId(
      id,
      cursor,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get recommended reels for the user' })
  @ApiResponse({ status: 200, description: 'List of recommended reels' })
  async getRecommendReels(@Req() req: any, @Query('limit') limit: number = 10) {
    const userId = req.user.userId;
    return this.recommendService.getRecommendedReels(userId, +limit);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a reel' })
  @ApiResponse({ status: 200, description: 'List of comments' })
  async getReelComments(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.reelCommentService.getReelComments(id, cursor, limit);
  }

  @Get(':id/comments/:parentId/replies')
  @ApiOperation({ summary: 'Get replies for a comment' })
  @ApiResponse({ status: 200, description: 'List of replies' })
  async getCommentReplies(
    @Param('parentId') parentId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.reelCommentService.getCommentReplies(parentId, cursor, limit);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Create a comment for a reel' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async createComment(
    @Param('id') reelId: string,
    @Req() req: any,
    @Body() body: { content: string; parentId?: string },
  ) {
    const userId = req.user.userId;
    const result = await this.reelCommentService.createComment({
      userId,
      reelId,
      content: body.content,
      parentId: body.parentId,
    });

    // Broadcast to realtime gateway
    this.socketGateway.broadcastReelComment(reelId, result.data);

    // ─── Gửi event tương tác xuống hệ thống CF ───
    try {
      // Lấy thông tin reel để biết ai là target (owner)
      const reelResult = await this.reelsService.getReelById(reelId, userId);
      if (reelResult.success && reelResult.data) {
        const targetUserId = reelResult.data.user_id;

        // Chỉ log nếu người comment khác người sở hữu reel
        if (targetUserId !== userId.toString()) {
          this.recommendService
            .logEvent({
              actor_user_id: userId,
              target_user_id: targetUserId,
              event_type: 'comment_reel',
              timestamp: new Date().toISOString(),
              content_id: reelId,
              metadata: {
                commentId: result.data.id,
                source: 'reels_controller',
              },
            })
            .catch((err) =>
              console.error('Failed to log comment_reel event to CF:', err.message),
            );
        }
        console.log('Commented on reel:', reelId);
      }
    } catch (error) {
      console.error('Error logging comment interaction for reel:', error);
    }

    return result;
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  async deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const result = await this.reelCommentService.deleteComment(
      commentId,
      userId,
    );

    // Broadcast to realtime gateway
    this.socketGateway.broadcastDeleteReelComment(id, commentId);

    return result;
  }
}
