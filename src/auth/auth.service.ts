import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.users.create({
      data: {
        email: dto.email,
        username: dto.username,
        password_hash: hashed,
      },
    });

    return this.generateTokens(user.id, user.email);
  }

  // 🔐 LOGIN
  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedException();

    return this.generateTokens(user.id, user.email);
  }

  // 🔁 REFRESH TOKEN
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      return this.generateTokens(payload.sub, payload.email);
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

  // 🔓 LOGOUT (placeholder)
  async logout(userId: number) {
    // implement token revocation / cleanup if you store refresh tokens
    return { ok: true };
  }
}
