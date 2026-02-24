import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy các cuộc trò chuyện của người dùng (có phân trang)' })
  @ApiResponse({ status: 200, description: 'Danh sách cuộc trò chuyện' })
  async getMyConversations(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.userId;
    return this.conversationService.getUserConversationsPaginated(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết cuộc trò chuyện' })
  async getConversationById(@Param('id') id: string) {
    return this.conversationService.getConversationById(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Lấy lịch sử tin nhắn của một cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn' })
  async getMessages(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.messageService.getMessages(id, cursor, Number(limit));
  }

  @Post('private/:recipientId')
  @ApiOperation({ summary: 'Tìm hoặc tạo cuộc trò chuyện riêng tư' })
  async createPrivateConversation(
    @Req() req: any,
    @Param('recipientId') recipientId: string,
  ) {
    const userId = req.user.userId;
    return this.conversationService.getOrCreatePrivateConversation(userId, recipientId);
  }
}
