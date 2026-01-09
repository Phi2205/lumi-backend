import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: any) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: any) {
    return this.auth.login(dto);
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  refresh(@Req() req) {
    return this.auth.refresh(req.user.refreshToken);
  }

  @Post('logout')
  logout(@Body('userId') userId: number) {
    return this.auth.logout(userId);
  }
}
