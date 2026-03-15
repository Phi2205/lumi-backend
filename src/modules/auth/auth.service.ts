import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';
import { BadRequestException } from '@nestjs/common';


@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private jwtService: JwtService,
    private redisService: RedisService,
    private emailService: EmailService,
  ) { }

  // Tạo username từ name và đảm bảo unique
  private async generateUniqueUsername(name: string): Promise<string> {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');

    let username = base || 'user';
    let counter = 1;

    // Nếu đã tồn tại thì thêm .2, .3, ...
    while (await this.authRepository.findByUsername(username)) {
      counter += 1;
      username = `${base || 'user'}.${counter}`;
    }

    return username;
  }

  // 🔐 REGISTER
  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.authRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5 minutes TTL (300 seconds)
    const otpKey = `otp:${dto.email}`;
    await this.redisService.set(otpKey, otp, 300);

    // Store registration data temporarily in Redis (5 minutes)
    const registerDataKey = `register:${dto.email}`;
    const registerData = JSON.stringify({
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });
    await this.redisService.set(registerDataKey, registerData, 300);

    // Send OTP to email
    await this.emailService.sendOTP(dto.email, otp);

    return {
      success: true,
      message: 'OTP has been sent to your email. Please verify to complete registration.',
    };
  }

  // 🔐 LOGIN
  async login(dto: LoginDto) {
    const user = await this.authRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Email not found');
    }

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid password');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      success: true,
      ...tokens,
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        user_location: user.user_location,
        birthday: user.birthday,
      },
    };
  }

  // 🔁 REFRESH TOKEN
  async refresh(refreshToken: string) {
    try {
      // Check if refresh token is blacklisted
      const isBlacklisted = await this.redisService.get(
        `blacklist:refresh:${refreshToken}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.authRepository.findById(payload.sub);

      if (!user) throw new UnauthorizedException();

      const tokens = await this.generateTokens(user.id, user.email);

      return {
        ...tokens,
        user: {
          id: user.id.toString(),
          email: user.email,
          username: user.username,
          avatar_url: user.avatar_url,
          bio: user.bio,
          user_location: user.user_location,
          birthday: user.birthday,
        },
      };
    } catch {
      throw new UnauthorizedException();
    }
  }

  // 🎯 TẠO TOKEN
  private async generateTokens(userId: bigint | number | string, email: string) {
    // Lấy user để có role
    const user = await this.authRepository.findById(userId);

    const payload = {
      sub: userId.toString(),
      email,
      role: (user as any)?.role || 'user' // Include role trong JWT payload
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET as string,
      expiresIn: process.env.JWT_EXPIRES_IN as any,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as any,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // 👤 LẤY THÔNG TIN USER HIỆN TẠI
  async getMe(userId: string) {
    const user = await this.authRepository.findById(userId);

    if (!user) throw new UnauthorizedException();

    return {
      success: true,
      message: 'User profile fetched successfully',
      data: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        user_location: user.user_location,
        birthday: user.birthday,
        created_at: user.created_at,
      },
    };
  }

  // ✅ VERIFY OTP
  async verifyOTP(dto: VerifyOtpDto) {
    // Get OTP from Redis
    const otpKey = `otp:${dto.email}`;
    const storedOTP = await this.redisService.get(otpKey);

    if (!storedOTP) {
      throw new BadRequestException('OTP has expired or is invalid. Please request a new OTP.');
    }

    // Verify OTP
    if (storedOTP !== dto.otp) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Get registration data from Redis
    const registerDataKey = `register:${dto.email}`;
    const registerDataStr = await this.redisService.get(registerDataKey);

    if (!registerDataStr) {
      throw new BadRequestException('Registration data has expired. Please register again.');
    }

    const registerData = JSON.parse(registerDataStr);

    // Check if email already exists (double check)
    const existingUser = await this.authRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password and create user
    const hashed = await bcrypt.hash(registerData.password, 10);

    const username = await this.generateUniqueUsername(registerData.name);

    const user = await this.authRepository.createUser({
      email: registerData.email,
      name: registerData.name,
      username,
      password_hash: hashed,
    });

    // Delete OTP and registration data from Redis
    await this.redisService.del(otpKey);
    await this.redisService.del(registerDataKey);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      success: true,
      ...tokens,
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        user_location: user.user_location,
        birthday: user.birthday,
      },
    };
  }

  // 🔄 RESEND OTP
  async resendOTP(dto: ResendOtpDto) {
    // Check if registration data exists
    const registerDataKey = `register:${dto.email}`;
    const registerDataStr = await this.redisService.get(registerDataKey);

    if (!registerDataStr) {
      throw new BadRequestException('No pending registration found for this email. Please register again.');
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store new OTP in Redis with 5 minutes TTL (300 seconds)
    const otpKey = `otp:${dto.email}`;
    await this.redisService.set(otpKey, otp, 300);

    // Send OTP to email
    await this.emailService.sendOTP(dto.email, otp);

    return {
      success: true,
      message: 'OTP has been resent to your email.',
    };
  }

  // 🔓 LOGOUT
  async logout(
    userId: bigint | number | string,
    accessToken?: string,
    refreshToken?: string,
  ) {
    // 1. Validate user exists
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 2. Blacklist access token
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as any;
        if (decoded?.exp) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await this.redisService.set(
              `blacklist:access:${accessToken}`,
              'true',
              expiresIn,
            );
          }
        }
      } catch (error) {
        // Ignore invalid token
      }
    }

    // 3. Blacklist refresh token
    if (refreshToken) {
      try {
        const decoded = this.jwtService.decode(refreshToken) as any;
        if (decoded?.exp) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await this.redisService.set(
              `blacklist:refresh:${refreshToken}`,
              'true',
              expiresIn,
            );
          }
        }
      } catch (error) {
        // Ignore invalid token
      }
    }

    // 4. Xóa refresh tokens của user (nếu có lưu)
    const userRefreshTokensKey = `user:${userId}:refresh_tokens`;
    await this.redisService.del(userRefreshTokensKey);

    // 5. Logout timestamp (optional - for tracking)
    await this.redisService.set(
      `user:${userId}:last_logout`,
      Date.now().toString(),
      7 * 24 * 60 * 60, // 7 days
    );

    // 6. Return success
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}
