import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  // 📸 TẠO STORY MỚI
  async createStory(userId: string, mediaUrl: string, mediaType: string) {
    // Stories thường expire sau 24 giờ
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = await this.prisma.stories.create({
      data: {
        user_id: BigInt(userId),
        media_url: mediaUrl,
        media_type: mediaType,
        expires_at: expiresAt,
      },
    });

    return {
      id: story.id.toString(),
      user_id: story.user_id.toString(),
      media_url: story.media_url,
      media_type: story.media_type,
      expires_at: story.expires_at,
      created_at: story.created_at,
    };
  }

  // 📋 LẤY TẤT CẢ STORIES CỦA USER
  async getUserStories(userId: string) {
    const stories = await this.prisma.stories.findMany({
      where: {
        user_id: BigInt(userId),
        expires_at: {
          gt: new Date(), // Chỉ lấy stories chưa hết hạn
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return stories.map((story) => ({
      id: story.id.toString(),
      user_id: story.user_id.toString(),
      media_url: story.media_url,
      media_type: story.media_type,
      expires_at: story.expires_at,
      created_at: story.created_at,
    }));
  }

  // 🗑️ XÓA STORY
  async deleteStory(storyId: string, userId: string) {
    const story = await this.prisma.stories.findUnique({
      where: { id: BigInt(storyId) },
    });

    if (!story) {
      throw new Error('Story not found');
    }

    if (story.user_id.toString() !== userId) {
      throw new Error('Unauthorized: You can only delete your own stories');
    }

    await this.prisma.stories.delete({
      where: { id: BigInt(storyId) },
    });

    return { success: true, message: 'Story deleted successfully' };
  }
}
