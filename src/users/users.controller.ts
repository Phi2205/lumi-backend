import { Controller, Get, Query, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    return this.usersService.findByUsername(username, currentUserId);
  }
}
