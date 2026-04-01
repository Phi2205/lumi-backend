import { Module } from '@nestjs/common';
import { FriendRequestsController } from './friend-requests.controller';
import { FriendRequestsService } from './friend-requests.service';
import { FriendRequestsRepository } from './friend-requests.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [PrismaModule, PassportModule, FriendsModule],
  controllers: [FriendRequestsController],
  providers: [FriendRequestsService, FriendRequestsRepository],
  exports: [FriendRequestsService, FriendRequestsRepository],
})
export class FriendRequestsModule {}
