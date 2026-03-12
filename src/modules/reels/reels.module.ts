import { Module } from '@nestjs/common';
import { ReelsService } from './services/reels.service';
import { ReelsController } from './controllers/reels.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReelsRepository } from './repositories/reels.repository';
import { ReelLikeService } from './services/reel-like.service';
import { ReelLikeRepository } from './repositories/reel-like.repository';

@Module({
    imports: [PrismaModule],
    controllers: [ReelsController],
    providers: [ReelsService, ReelsRepository, ReelLikeService, ReelLikeRepository],
    exports: [ReelsService, ReelsRepository, ReelLikeService, ReelLikeRepository],
})
export class ReelsModule { }
