import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostsRepository } from './posts.repository';
import { PostMediaRepository } from '../post-media/post-media.repository';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [PrismaModule, RedisModule, FriendsModule],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository, PostMediaRepository],
  exports: [PostsService],
})
export class PostsModule {}

