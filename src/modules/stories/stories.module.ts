import { Module, forwardRef } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [PrismaModule, RedisModule, forwardRef(() => RealtimeModule), FriendsModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule { }
