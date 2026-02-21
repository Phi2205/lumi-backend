import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RecommendService } from './recommend.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [RecommendService],
  exports: [RecommendService],
})
export class RecommendModule {}
