import { Module, forwardRef } from '@nestjs/common';
import { StoriesModule } from '../stories/stories.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersRepository } from './users.repository';
import { FriendRequestsRepository } from '../friend-requests/friend-requests.repository';
import { FriendsRepository } from '../friends/friends.repository';
import { RecommendModule } from '../recommend/recommend.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RecommendModule),
    RedisModule,
    forwardRef(() => StoriesModule),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    FriendRequestsRepository,
    FriendsRepository,
  ],
  exports: [UsersService],
})
export class UsersModule { }
