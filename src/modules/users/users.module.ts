import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersRepository } from './users.repository';
import { FriendRequestsRepository } from '../friend-requests/friend-requests.repository';
import { FriendsRepository } from '../friends/friends.repository';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, FriendRequestsRepository, FriendsRepository],
})
export class UsersModule {}
