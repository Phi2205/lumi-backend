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

@Module({
    imports: [PrismaModule, forwardRef(() => RealtimeModule)],
    controllers: [ReelsController],
    providers: [ReelsService, ReelsRepository, ReelLikeService, ReelLikeRepository, ReelCommentService, ReelCommentRepository],
    exports: [ReelsService, ReelsRepository, ReelLikeService, ReelLikeRepository, ReelCommentService, ReelCommentRepository],
})
export class ReelsModule { }
