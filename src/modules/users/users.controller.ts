import {
  Controller,
  Get,
  Query,
  Param,
  Request,
  UseGuards,
  Patch,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RecommendService } from '../recommend/recommend.service';
import { RedisService } from 'src/redis/redis.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly recommendService: RecommendService,
    private readonly redisService: RedisService,
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
}
