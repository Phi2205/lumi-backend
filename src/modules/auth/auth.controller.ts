import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ 
    status: 201, 
    description: 'OTP sent to email successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OTP has been sent to your email. Please verify to complete registration.' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Conflict - Email is already registered' })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.auth.register(dto);
    return result;
  }

  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            email: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: 'johndoe' },
            avatar_url: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid credentials' })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = isProduction || process.env.FORCE_SECURE_COOKIES === 'true';

    // Set tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
    
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });


    // Return success and user info without tokens
    return {
      success: result.success,
      user: result.user,
    };
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid refresh token' })
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  async refresh(@Req() req, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.user.refreshToken);
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = isProduction || process.env.FORCE_SECURE_COOKIES === 'true';

    // Set new tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return result.user;
  }

  @ApiOperation({ summary: 'Get current user information' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 200, description: 'User information retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Req() req) {
    return this.auth.getMe(req.user.userId);
  }

  @ApiOperation({ summary: 'Verify OTP and complete registration' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP verified successfully, user created',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            email: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: 'johndoe' },
            avatar_url: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid or expired OTP' })
  @ApiResponse({ status: 409, description: 'Conflict - Email is already registered' })
  @Post('verify-otp')
  async verifyOTP(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyOTP(dto);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = isProduction || process.env.FORCE_SECURE_COOKIES === 'true';

    // Set tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Return success and user info without tokens
    return {
      success: result.success,
      user: result.user,
    };
  }

  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiBody({ type: ResendOtpDto })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP resent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OTP has been resent to your email.' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - No pending registration found' })
  @Post('resend-otp')
  async resendOTP(@Body() dto: ResendOtpDto) {
    return this.auth.resendOTP(dto);
  }

  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    // Get tokens from cookies or headers
    const accessToken =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace('Bearer ', '');
    const refreshToken = req.cookies?.refreshToken;

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    // Call service với tokens để blacklist
    return this.auth.logout(req.user.userId, accessToken, refreshToken);
  }
}
