import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { FriendsModule } from '../friends/friends.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { PostsController } from './controllers/posts.controller';
import { PostService } from './services/post.service';
import { PostRepository } from './repositories/post.repository';
import { PostMediaRepository } from './repositories/post-media.repository';
import { PostMediaService } from './services/post-media.service';
import { PostLikeRepository } from './repositories/post-like.repository';
import { PostLikeService } from './services/post-like.service';
import { PostCommentRepository } from './repositories/post-comment.repository';
import { PostCommentService } from './services/post-comment.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    FriendsModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [PostsController],
  providers: [
    PostService,
    PostRepository,
    PostMediaRepository,
    PostMediaService,
    PostLikeRepository,
    PostLikeService,
    PostCommentRepository,
    PostCommentService,
  ],
  exports: [PostService, PostCommentService, PostLikeService, PostMediaService],
})
export class PostsModule {}
