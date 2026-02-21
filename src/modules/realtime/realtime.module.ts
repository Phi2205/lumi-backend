import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { PostGateway } from './gateways/post.gateway';
import { CommentGateway } from './gateways/comment.gateway';
import { NotificationGateway } from './gateways/notification.gateway';
import { ChatGateway } from './gateways/chat.gateway';
import { RedisIoAdapter } from './adapters/redis.adapter';
import { PostsModule } from '../posts/posts.module'; // Import PostsModule
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => PostsModule),
    ChatModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    RealtimeService,
    PostGateway,
    CommentGateway,
    NotificationGateway, // This gateway handles connection/auth
    ChatGateway,
    RedisIoAdapter,
  ],
  exports: [RealtimeService, CommentGateway],
})
export class RealtimeModule {}
