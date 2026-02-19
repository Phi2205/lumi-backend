import { Body, Controller, Get, Param, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors, Inject, forwardRef } from '@nestjs/common';
import { CommentGateway } from 'src/modules/realtime/gateways/comment.gateway';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostService } from '../services/post.service';
import { PostLikeService } from '../services/post-like.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { cloudinaryPostStorage } from 'src/config/multer.config';

import { PostCommentService } from '../services/post-comment.service';

@ApiTags('posts')
@Controller('posts')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class PostsController {
  constructor(
    private postService: PostService,
    private postLikeService: PostLikeService,
    private postCommentService: PostCommentService,
    @Inject(forwardRef(() => CommentGateway))
    private readonly commentGateway: CommentGateway,
  ) {}

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
  @UseInterceptors(FilesInterceptor('files', 10, { storage: cloudinaryPostStorage }))
  async create(
    @Req() req: any,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Array<Express.Multer.File & { url?: string; public_id?: string }>,
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

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like a post' })
  @ApiResponse({ status: 200, description: 'Post liked/unliked successfully' })
  async toggleLike(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    return this.postLikeService.toggleLike(id, userId);
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
    this.commentGateway.broadcastComment(postId, result.data);

    return result;
  }
}
