import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationService } from './services/conversation.service';
import { MessageRepository } from './repositories/message.repository';
import { MessageService } from './services/message.service';
import { ConversationParticipantsRepository } from './repositories/conversationParticipants.repository';
import { ConversationController } from './controllers/conversation.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ConversationController],
  providers: [
    ConversationRepository,
    ConversationService,
    MessageRepository,
    MessageService,
    ConversationParticipantsRepository,
  ],
  exports: [ConversationService, MessageService, ConversationParticipantsRepository],
})
export class ChatModule {}
