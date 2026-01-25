import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    AuthModule,
    UsersModule,
    StoriesModule,
    FriendRequestsModule,
    FriendsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
