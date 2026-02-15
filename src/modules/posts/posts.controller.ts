import { Body, Controller, Get, Param, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { cloudinaryPostStorage } from 'src/config/multer.config';

@ApiTags('posts')
@Controller('posts')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class PostsController {
  constructor(private postsService: PostsService) {}

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

    return this.postsService.createPost({
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
    return this.postsService.toggleLike(id, userId);
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
    await this.postsService.markPostsAsSeen(postIds, userId);
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
    return this.postsService.getUnseenPosts(userId, page, limit);
  }
}

