import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parsePaginationParams, createPaginationMeta } from 'src/utils/pagination';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  // 📸 TẠO STORY MỚI
  async createStory(userId: string, mediaUrl: string|undefined, mediaType: string) {
    // Stories thường expire sau 24 giờ
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = await this.prisma.stories.create({
      data: {
        user_id: BigInt(userId),
        media_url: mediaUrl || '',
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

  /**
   * Lấy danh sách friends có stories active (chỉ metadata) với phân trang
   * GET /stories/feed?page=1&limit=10
   */
  async getFriendsWithStories(
    currentUserId: string,
    page?: string | number,
    limit?: string | number,
  ) {
    // Parse pagination params
    const { page: pageNumber, limit: limitNumber } = parsePaginationParams(page, limit);

    // Lấy danh sách friends
    const friendships = await this.prisma.friends.findMany({
      where: {
        user_id: BigInt(currentUserId),
      },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    // Lấy thông tin stories cho mỗi friend
    const friendsWithStories = await Promise.all(
      friendships.map(async (friendship) => {
        const friendId = friendship.friend_id;

        // Lấy story mới nhất và count stories active
        const [latestStory, storyCount] = await Promise.all([
          this.prisma.stories.findFirst({
            where: {
              user_id: friendId,
              expires_at: {
                gt: new Date(),
              },
            },
            orderBy: {
              created_at: 'desc',
            },
            select: {
              created_at: true,
            },
          }),
          this.prisma.stories.count({
            where: {
              user_id: friendId,
              expires_at: {
                gt: new Date(),
              },
            },
          }),
        ]);

        // Chỉ return nếu có stories active
        if (storyCount === 0) {
          return null;
        }

        return {
          id: friendId.toString(),
          name: friendship.friend.name,
          username: friendship.friend.username,
          avatar_url: friendship.friend.avatar_url,
          story_count: storyCount,
          latest_story_time: latestStory?.created_at || null,
        };
      }),
    );

    // Filter out null values và sort by latest_story_time (mới nhất trước)
    const filtered = friendsWithStories
      .filter((item) => item !== null)
      .sort((a, b) => {
        if (!a.latest_story_time) return 1;
        if (!b.latest_story_time) return -1;
        return (
          new Date(b.latest_story_time).getTime() -
          new Date(a.latest_story_time).getTime()
        );
      });

    // Áp dụng phân trang
    const total = filtered.length;
    const offset = (pageNumber - 1) * limitNumber;
    const paginatedItems = filtered.slice(offset, offset + limitNumber);

    return {
      success: true,
      message: 'Friends with stories fetched successfully',
      data: {
        items: paginatedItems,
        pagination: createPaginationMeta(pageNumber, limitNumber, total),
      },
    };
  }

  /**
   * Lấy stories của một user cụ thể
   * GET /stories/user/:userId
   */
  async getUserStoriesForViewer(userId: string, viewerId: string) {
    // Kiểm tra xem viewer có phải là friend không
    const areFriends = await this.prisma.friends.findUnique({
      where: {
        user_id_friend_id: {
          user_id: BigInt(viewerId),
          friend_id: BigInt(userId),
        },
      },
    });

    if (!areFriends) {
      throw new Error('You can only view stories of your friends');
    }

    // Lấy user info
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        name: true,
        username: true,
        avatar_url: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Lấy stories của user (chưa hết hạn, sắp xếp cũ → mới)
    const stories = await this.prisma.stories.findMany({
      where: {
        user_id: BigInt(userId),
        expires_at: {
          gt: new Date(),
        },
      },
      orderBy: {
        created_at: 'asc', // CŨ → MỚI (để xem từ đầu)
      },
    });

    // Format response
    const cloudName =
      process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME;

    const formattedStories = stories.map((story) => {
      const baseStory = {
        id: story.id.toString(),
        media_url: story.media_url,
        media_type: story.media_type,
        created_at: story.created_at,
        expires_at: story.expires_at,
      };

      // Nếu là video, thêm streaming_url
      if (story.media_type === 'video' && cloudName) {
        // media_url là public_id (từ CloudinaryStorage)
        const publicId = story.media_url;
        return {
          ...baseStory,
          streaming_url: `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${publicId}.m3u8`,
        };
      }

      return baseStory;
    });

    return {
      success: true,
      message: 'Stories fetched successfully',
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          username: user.username,
          avatar_url: user.avatar_url,
        },
        stories: formattedStories,
      },
    };
  }
}
