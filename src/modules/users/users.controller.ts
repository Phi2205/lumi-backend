import {
  Controller,
  Get,
  Query,
  Param,
  Request,
  UseGuards,
  Post,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { StoriesService } from '../stories/stories.service';
import { UsersService } from './users.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RecommendService } from '../recommend/recommend.service';
import { RedisService } from 'src/redis/redis.service';
import { cloudinaryProfileStorage } from 'src/config/multer.config';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly recommendService: RecommendService,
    private readonly redisService: RedisService,
    private readonly storiesService: StoriesService,
  ) { }

  // GET /users?name=abc&page=1&limit=20
  @Get()
  async filterByName(
    @Query('name') name?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;

    return this.usersService.findByName(name, pageNumber, limitNumber);
  }

  // GET /users/username/:username
  @Get('username/:username')
  @UseGuards(AuthGuard('jwt'))
  async getByUsername(
    @Param('username') username: string,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.userId;
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace('Bearer ', '');
    const result = await this.usersService.findByUsername(
      username,
      currentUserId,
      token,
    );

    if (
      result.success &&
      result.data &&
      currentUserId &&
      String(currentUserId) !== String(result.data.id)
    ) {
      const lockKey = `view_profile_lock:${currentUserId}:${result.data.id}`;
      const isLocked = await this.redisService.get(lockKey);

      if (!isLocked) {
        // Set lock in Redis for 10 seconds to prevent StrictMode double call
        await this.redisService.set(lockKey, '1', 10);

        this.recommendService
          .logEvent({
            actor_user_id: currentUserId,
            target_user_id: result.data.id,
            event_type: 'view_profile',
            timestamp: new Date().toISOString(),
            session_id: token,
          })
          .catch((err) =>
            console.error('[Recommend] logEvent view_profile failed', err),
          );
      }

      // Thêm thông tin hasStory
      const has_story = await this.storiesService.hasStory(result.data.id);
      (result.data as any).has_story = has_story;
    }

    return result;
  }

  @Get(':userId/hover-card')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get user info for hover card' })
  async getHoverCard(@Param('userId') userId: string) {
    return this.usersService.getHoverCard(userId);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user profile info' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user.userId;
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('avatar')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (jpg, png, jpeg, webp)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @UseInterceptors(
    FileInterceptor('file', { storage: cloudinaryProfileStorage }),
  )
  async updateAvatar(
    @Request() req: any,
    @UploadedFile()
    file: Express.Multer.File & { url?: string; public_id?: string },
  ) {
    if (!file || !file.url) {
      throw new Error('File upload failed');
    }

    const userId = req.user.userId;
    return this.usersService.updateAvatar(userId, file.url);
  }

  @Patch('cover-image')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user cover image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Cover image file (jpg, png, jpeg, webp)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cover image updated successfully' })
  @UseInterceptors(
    FileInterceptor('file', { storage: cloudinaryProfileStorage }),
  )
  async updateCoverImage(
    @Request() req: any,
    @UploadedFile()
    file: Express.Multer.File & { url?: string; public_id?: string },
  ) {
    if (!file || !file.url) {
      throw new Error('File upload failed');
    }

    const userId = req.user.userId;
    return this.usersService.updateCoverImage(userId, file.url);
  }
}
