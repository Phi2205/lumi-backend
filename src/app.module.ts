import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoriesModule } from './modules/stories/stories.module';
import { CloudinaryModule } from './config/cloudinary.module';
import { FriendRequestsModule } from './modules/friend-requests/friend-requests.module';
import { FriendsModule } from './modules/friends/friends.module';
import { CommonModule } from './common/common.module';
import { PostsModule } from './modules/posts/posts.module';
import { RecommendModule } from './modules/recommend/recommend.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { UploadFileModule } from './modules/upload-file/upload-file.module';
import { ReelsModule } from './modules/reels/reels.module';

import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Chỉ định file .env để load config
    }),
    PrismaModule,
    RedisModule,
    CloudinaryModule,
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StoriesModule,
    PostsModule,
    FriendRequestsModule,
    FriendsModule,
    RecommendModule,
    RealtimeModule,
    UploadFileModule,
    ReelsModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        let redisInstance: Redis;
        if (redisUrl) {
          redisInstance = new Redis(redisUrl.replace(/["']/g, '').trim());
        } else {
          redisInstance = new Redis({
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB') || 0,
          });
        }

        return {
          throttlers: [
            {
              name: 'short',
              ttl: 1000,
              limit: 5,
            },
            {
              name: 'medium',
              ttl: 10000,
              limit: 20,
            },
            {
              name: 'long',
              ttl: 60000,
              limit: 100,
            },
          ],
          storage: new ThrottlerStorageRedisService(redisInstance),
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
