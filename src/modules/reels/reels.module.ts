import { Module, forwardRef } from '@nestjs/common';
import { ReelsService } from './services/reels.service';
import { ReelsController } from './controllers/reels.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReelsRepository } from './repositories/reels.repository';
import { ReelLikeService } from './services/reel-like.service';
import { ReelLikeRepository } from './repositories/reel-like.repository';
import { ReelCommentService } from './services/reel-comment.service';
import { ReelCommentRepository } from './repositories/reel-comment.repository';
import { RealtimeModule } from '../realtime/realtime.module';
import { RecommendModule } from '../recommend/recommend.module';
import { ReelViewService } from './services/reel-view.service';
import { ReelViewRepository } from './repositories/reel-view.repository';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RealtimeModule),
    forwardRef(() => RecommendModule),
    RedisModule, // Added RedisModule
  ],
  controllers: [ReelsController],
  providers: [
    ReelsService,
    ReelsRepository,
    ReelLikeService,
    ReelLikeRepository,
    ReelCommentService,
    ReelCommentRepository,
    ReelViewService,
    ReelViewRepository,
  ],
  exports: [
    ReelsService,
    ReelsRepository,
    ReelLikeService,
    ReelLikeRepository,
    ReelCommentService,
    ReelCommentRepository,
    ReelViewService,
    ReelViewRepository,
  ],
})
export class ReelsModule { }
