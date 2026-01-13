import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';


@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.users.create({
      data: {
        email: dto.email,
        username: dto.username,
        password_hash: hashed,
      },
    });

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

  // 🔓 LOGOUT (placeholder)
  async logout(userId: number) {
    // implement token revocation / cleanup if you store refresh tokens
    return { ok: true };
  }
}
