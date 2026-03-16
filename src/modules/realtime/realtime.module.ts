import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { PresenceService } from './services/presence.service';
import { SocketGateway } from './gateways/socket.gateway';
import { RedisIoAdapter } from './adapters/redis.adapter';
import { PostsModule } from '../posts/posts.module';
import { ChatModule } from '../chat/chat.module';
import { FriendsModule } from '../friends/friends.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => PostsModule),
    ChatModule,
    FriendsModule,
    RedisModule, // Added RedisModule
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
    PresenceService, // Added PresenceService
    SocketGateway,
    RedisIoAdapter,
  ],
  exports: [RealtimeService, PresenceService, SocketGateway],
})
export class RealtimeModule {}
