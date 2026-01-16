import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StoriesService } from './stories.service';
import { cloudinaryStorage } from 'src/config/multer.config';
import { CreateStoryDto } from './dto/create-story.dto';

@ApiTags('stories')
@Controller('stories')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  @ApiOperation({ summary: 'Create a new story' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image or video file (jpg, png, jpeg, webp, mp4, webm)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Story created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '1' },
        user_id: { type: 'string', example: '1' },
        media_url: { type: 'string', example: 'https://res.cloudinary.com/...' },
        media_type: { type: 'string', example: 'image' },
        expires_at: { type: 'string', format: 'date-time' },
        created_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: cloudinaryStorage }))
  async createStory(
    @UploadedFile() file: Express.Multer.File & { url?: string; public_id?: string },
    @Req() req: any,
  ) {
    if (!file || !file.url) {
      throw new Error('File upload failed');
    }

    // Determine media type from mimetype
    const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

    return this.storiesService.createStory(req.user.userId, file.url, mediaType);
  }

  @ApiOperation({ summary: 'Get all stories of current user' })
  @ApiResponse({
    status: 200,
    description: 'List of user stories',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          user_id: { type: 'string' },
          media_url: { type: 'string' },
          media_type: { type: 'string' },
          expires_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @Get('me')
  async getMyStories(@Req() req: any) {
    return this.storiesService.getUserStories(req.user.userId);
  }

  @ApiOperation({ summary: 'Delete a story' })
  @ApiResponse({ status: 200, description: 'Story deleted successfully' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  @ApiResponse({ status: 403, description: 'Unauthorized' })
  @Delete(':id')
  async deleteStory(@Param('id') id: string, @Req() req: any) {
    return this.storiesService.deleteStory(id, req.user.userId);
  }
}
