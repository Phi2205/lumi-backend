import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationService } from './services/conversation.service';
import { MessageRepository } from './repositories/message.repository';
import { MessageService } from './services/message.service';

@Module({
  imports: [PrismaModule],
  providers: [ConversationRepository, ConversationService, MessageRepository, MessageService],
  exports: [ConversationService, MessageService],
})
export class ChatModule {}
