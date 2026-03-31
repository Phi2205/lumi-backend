import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RecommendService } from './recommend.service';
import { RecommendController } from './recommend.controller';

import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    PrismaModule,
    RedisModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [RecommendController],
  providers: [RecommendService],
  exports: [RecommendService],
})
export class RecommendModule { }
