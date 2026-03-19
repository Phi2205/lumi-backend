import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Inject,
  forwardRef,
  Delete,
} from '@nestjs/common';
import { SocketGateway } from 'src/modules/realtime/gateways/socket.gateway';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostService } from '../services/post.service';
import { PostLikeService } from '../services/post-like.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { cloudinaryPostStorage } from 'src/config/multer.config';

import { PostCommentService } from '../services/post-comment.service';
import { RecommendService } from 'src/modules/recommend/recommend.service';

@ApiTags('posts')
@Controller('posts')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class PostsController {
  constructor(
    private postService: PostService,
    private postLikeService: PostLikeService,
    private postCommentService: PostCommentService,
    private recommendService: RecommendService,
    @Inject(forwardRef(() => SocketGateway))
    private readonly socketGateway: SocketGateway,
  ) { }

  @ApiOperation({ summary: 'Create a new post (supports multiple media)' })
  @ApiResponse({ status: 201, description: 'Post created' })
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', nullable: true },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, { storage: cloudinaryPostStorage }),
  )
  async create(
    @Req() req: any,
    @Body() dto: CreatePostDto,
    @UploadedFiles()
    files: Array<Express.Multer.File & { url?: string; public_id?: string }>,
  ) {
    const userId = req.user.userId;
    const media =
      files?.map((f, idx) => ({
        media_url: f.url || '',
        media_type: f.mimetype?.startsWith('video') ? 'video' : 'image',
        order: idx,
      })) ?? [];

    return this.postService.createPost({
      user_id: userId,
      content: dto.content ?? null,
      media,
    });
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
    const result = await this.postCommentService.deleteComment(
      commentId,
      userId,
    );

    // Broadcast to realtime gateway
    this.socketGateway.broadcastDeleteComment(id, commentId);

    return result;
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like a post' })
  @ApiResponse({ status: 200, description: 'Post liked/unliked successfully' })
  async toggleLike(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.postLikeService.toggleLike(id, userId);
  }

  @Get(':id/likes')
  @ApiOperation({ summary: 'Get all likes for a post' })
  @ApiResponse({ status: 200, description: 'List of users who liked the post' })
  async getLikesByPostId(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.postLikeService.getLikesByPostId(id, +page, +limit);
  }

  @Post('seen')
  @ApiOperation({ summary: 'Mark multiple posts as seen' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        postIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of post IDs to mark as seen',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Posts marked as seen' })
  async markAsSeen(@Body('postIds') postIds: string[], @Req() req: any) {
    const userId = req.user.userId;
    await this.postService.markPostsAsSeen(postIds, userId);
    return { success: true, message: 'Posts marked as seen' };
  }

  @Get('unseen')
  @ApiOperation({ summary: 'Get unseen posts' })
  @ApiResponse({ status: 200, description: 'List of unseen posts' })
  async getUnseenPosts(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.userId;
    return this.postService.getUnseenPosts(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({ status: 200, description: 'Post details' })
  async getPostById(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.postService.getPostById(id, userId);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  @ApiResponse({ status: 200, description: 'List of comments' })
  async getPostComments(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.postCommentService.getPostComments(id, page, limit);
  }

  @Get(':id/comments/:parentId/replies')
  @ApiOperation({ summary: 'Get replies for a comment' })
  @ApiResponse({ status: 200, description: 'List of replies' })
  async getCommentReplies(
    @Param('parentId') parentId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.postCommentService.getCommentReplies(parentId, page, limit);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Create a comment for a post' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        parentId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async createComment(
    @Param('id') postId: string,
    @Req() req: any,
    @Body() body: { content: string; parentId?: string },
  ) {
    const userId = req.user.userId;
    const result = await this.postCommentService.createComment({
      userId,
      postId,
      content: body.content,
      parentId: body.parentId,
    });

    // Broadcast to realtime gateway
    this.socketGateway.broadcastComment(postId, result.data);

    // ─── Gửi event tương tác xuống hệ thống CF ───
    try {
      // Lấy thông tin post để biết ai là target (owner)
      const postResult = await this.postService.getPostById(postId, userId);
      if (postResult.success && postResult.data) {
        const targetUserId = postResult.data.user_id;

        // Chỉ log nếu người comment khác người sở hữu post
        if (targetUserId !== userId.toString()) {
          this.recommendService
            .logEvent({
              actor_user_id: userId,
              target_user_id: targetUserId,
              event_type: 'comment_post',
              timestamp: new Date().toISOString(),
              content_id: postId,
              metadata: {
                commentId: result.data.id,
                source: 'posts_controller',
              },
            })
            .catch((err) =>
              console.error('Failed to log comment_post event to CF:', err.message),
            );
        }
      }
    } catch (error) {
      console.error('Error logging comment interaction:', error);
    }

    return result;
  }

  // ─── Share ───────────────────────────────────────────────────────────────────

  @Post(':id/share')
  @ApiOperation({ summary: 'Share a post' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          nullable: true,
          description: 'Nội dung kèm khi share (tuỳ chọn)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Post shared successfully' })
  async sharePost(
    @Param('id') originalPostId: string,
    @Req() req: any,
    @Body('content') content?: string,
  ) {
    const userId = req.user.userId;
    return this.postService.sharePost({
      user_id: userId,
      original_post_id: originalPostId,
      content: content ?? null,
    });
  }

  @Get('user/shares')
  @ApiOperation({ summary: 'Get all posts shared by the current user' })
  @ApiResponse({ status: 200, description: 'List of shared posts by user' })
  async getMySharedPosts(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.userId;
    return this.postService.getSharedPostsByUser(userId, +page, +limit);
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'Get all shares of a post' })
  @ApiResponse({
    status: 200,
    description: 'List of users who shared the post',
  })
  async getPostShares(
    @Param('id') postId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.postService.getSharesByPost(postId, +page, +limit);
  }
}
