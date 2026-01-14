import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private emailService: EmailService,
  ) {}

  // 🔐 REGISTER
  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

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
      username: dto.username,
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
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

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
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
      },
    };
  }

  // 🔁 REFRESH TOKEN
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.users.findUnique({
        where: { id: BigInt(payload.sub) },
      });

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
        },
      };
    } catch {
      throw new UnauthorizedException();
    }
  }

  // 🎯 TẠO TOKEN
  private async generateTokens(userId: bigint | number | string, email: string) {
    const payload = { sub: userId.toString(), email };

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
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user) throw new UnauthorizedException();

    return {
      id: user.id.toString(),
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at,
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
    const existingUser = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password and create user
    const hashed = await bcrypt.hash(registerData.password, 10);

    const user = await this.prisma.users.create({
      data: {
        email: registerData.email,
        username: registerData.username,
        password_hash: hashed,
      },
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

  // 🔓 LOGOUT (placeholder)
  async logout(userId: number) {
    // implement token revocation / cleanup if you store refresh tokens
    return { ok: true };
  }
}
