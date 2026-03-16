import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RefreshJwtStrategy } from './refresh.strategy';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN as any) || '15m',
      },
    }), // config trong service
  ],
  providers: [AuthService, AuthRepository, JwtStrategy, RefreshJwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
