import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  Body,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  ) { }

  @Get()
  @ApiOperation({
    summary: 'Lấy các cuộc trò chuyện của người dùng (có phân trang)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách cuộc trò chuyện' })
  async getMyConversations(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.userId;
    return this.conversationService.getUserConversationsPaginated(
      userId,
      page,
      limit,
    );
  }

  @Get('search')
  @ApiOperation({
    summary: 'Tìm kiếm cuộc trò chuyện của người dùng',
  })
  @ApiResponse({ status: 200, description: 'Danh sách cuộc trò chuyện phù hợp' })
  async searchConversations(
    @Req() req: any,
    @Query('query') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.userId;
    return this.conversationService.searchUserConversations(
      userId,
      query || '',
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một cuộc trò chuyện' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết cuộc trò chuyện',
  })
  async getConversationById(@Param('id') id: string, @Req() req: any) {
    return this.conversationService.getConversationById(id, req.user.userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Lấy lịch sử tin nhắn của một cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn' })
  async getMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 50,
  ) {
    const userId = req.user.userId;
    return this.messageService.getMessages(id, userId, cursor, Number(limit));
  }

  @Post('private/:recipientId')
  @ApiOperation({ summary: 'Tìm hoặc tạo cuộc trò chuyện riêng tư' })
  async createPrivateConversation(
    @Req() req: any,
    @Param('recipientId') recipientId: string,
  ) {
    const userId = req.user.userId;
    return this.conversationService.getOrCreatePrivateConversation(
      userId,
      recipientId,
    );
  }

  @Get(':id/media')
  @ApiOperation({
    summary: 'Lấy danh sách media (ảnh/video) của một cuộc trò chuyện',
  })
  @ApiResponse({ status: 200, description: 'Danh sách media' })
  async getMedia(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.messageService.getConversationMedia(id, cursor, Number(limit));
  }

  @Get(':id/messages/search')
  @ApiOperation({ summary: 'Tìm kiếm tin nhắn trong cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn tìm thấy' })
  async searchMessages(
    @Param('id') id: string,
    @Query('query') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const offset = (Number(page) - 1) * Number(limit);
    return this.messageService.searchMessages(id, query, Number(limit), offset);
  }

  @Get(':id/messages/:messageId/around')
  @ApiOperation({
    summary: 'Lấy tin nhắn xung quanh một tin nhắn cụ thể (10 trước, 10 sau)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tin nhắn bao gồm context',
  })
  async getMessagesAround(
    @Req() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Query('limit') limit: number = 10,
  ) {
    const userId = req.user.userId;
    return this.messageService.getMessagesAround(
      id,
      messageId,
      userId,
      Number(limit),
    );
  }

  @Get(':id/messages/older')
  @ApiOperation({ summary: 'Lấy tin nhắn cũ hơn cursor (Load Older)' })
  async getOlderMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query('limit') limit: number = 20,
  ) {
    const userId = req.user.userId;
    return this.messageService.getOlderMessages(
      id,
      cursor,
      userId,
      Number(limit),
    );
  }

  @Get(':id/messages/newer')
  @ApiOperation({ summary: 'Lấy tin nhắn mới hơn cursor (Load Newer)' })
  async getNewerMessages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query('limit') limit: number = 20,
  ) {
    const userId = req.user.userId;
    return this.messageService.getNewerMessages(
      id,
      cursor,
      userId,
      Number(limit),
    );
  }

  @Post('group')
  @ApiOperation({ summary: 'Tạo cuộc trò chuyện nhóm' })
  async createGroupConversation(
    @Req() req: any,
    @Body() body: { userIds: string[]; name?: string; avatar?: string },
  ) {
    const userId = req.user.userId;
    return this.conversationService.createGroupConversation(
      userId,
      body.userIds,
      body.name,
      body.avatar,
    );
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Thêm thành viên vào cuộc trò chuyện nhóm' })
  async addParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
  ) {
    const userId = req.user.userId;
    return this.conversationService.addParticipantsToGroup(
      id,
      userId,
      body.userIds,
    );
  }

  @Get(':id/check-owner')
  @ApiOperation({ summary: 'Kiểm tra xem user hiện tại có phải là trưởng nhóm hay không' })
  async checkGroupOwner(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.conversationService.checkGroupOwner(id, userId);
  }

  @Delete(':id/participants/:userId')
  @ApiOperation({ summary: 'Xóa thành viên khỏi nhóm' })
  async removeParticipant(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const removerId = req.user.userId;
    return this.conversationService.removeParticipantFromGroup(
      id,
      removerId,
      targetUserId,
    );
  }
}
