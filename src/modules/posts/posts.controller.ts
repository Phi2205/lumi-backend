import { Body, Controller, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
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
}

