import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { FriendsRepository } from './friends.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsRepository],
  exports: [FriendsService, FriendsRepository], // Export để friend-requests module có thể dùng
})
export class FriendsModule {}
