import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { SocketGateway } from './gateways/socket.gateway';
import { RedisIoAdapter } from './adapters/redis.adapter';
import { PostsModule } from '../posts/posts.module';
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
    SocketGateway,
    RedisIoAdapter,
  ],
  exports: [RealtimeService, SocketGateway],
})
export class RealtimeModule {}
