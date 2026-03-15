import { Controller, Get, Query, Param, Request, UseGuards, Patch, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

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
  async getByUsername(@Param('username') username: string, @Request() req: any) {
    const currentUserId = req.user?.userId;
    const token = req.cookies?.accessToken ||
      req.headers.authorization?.replace('Bearer ', '');
    return this.usersService.findByUsername(username, currentUserId, token);
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
