import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PresenceService } from '../realtime/services/presence.service';
import { FriendsService } from '../friends/friends.service';
import {
  parsePaginationParams,
  createPaginationMeta,
} from 'src/utils/pagination';

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @Inject(forwardRef(() => RealtimeService))
    private realtime: RealtimeService,
    @Inject(forwardRef(() => PresenceService))
    private presence: PresenceService,
    private friends: FriendsService,
  ) { }

  /**
   * 🔍 KIỂM TRA USER CÓ STORY ACTIVE KHÔNG
   * Kết hợp Redis cache 24h & Realtime update
   */
  async hasStory(userId: string): Promise<boolean> {
    const cacheKey = `user:has_story:${userId}`;

    try {
      // 1. Kiểm tra trong Redis cache
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }

      // 2. Nếu không có trong cache, query Database
      const count = await this.prisma.stories.count({
        where: {
          user_id: BigInt(userId),
          expires_at: {
            gt: new Date(),
          },
        },
      });

      const has = count > 0;

      // 3. Lưu vào Redis với TTL 24h (86400s)
      await this.redis.set(cacheKey, has.toString(), 86400);

      return has;
    } catch (error) {
      this.logger.error(`Error in hasStory for user ${userId}:`, error);
      // Fallback query DB nếu Redis lỗi
      const count = await this.prisma.stories.count({
        where: {
          user_id: BigInt(userId),
          expires_at: {
            gt: new Date(),
          },
        },
      });
      return count > 0;
    }
  }

  /**
   * 🔍 KIỂM TRA USER CÓ STORY CHƯA XEM KHÔNG (DÀNH CHO VIEWER)
   */
  async hasUnseenStory(userId: string, viewerId: string): Promise<boolean> {
    try {
      // 1. Lấy tất cả active story ids của user
      const activeStories = await this.prisma.stories.findMany({
        where: {
          user_id: BigInt(userId),
          expires_at: { gt: new Date() },
        },
        select: { id: true },
      });

      if (activeStories.length === 0) return false;

      // 2. Lấy danh sách các story đã xem của viewer từ Redis
      const seenKey = `user:seen_stories:${viewerId}`;
      const seenStoryIds = await this.redis.smembers(seenKey);
      const seenSet = new Set(seenStoryIds);

      // 3. Kiểm tra xem có story nào chưa nằm trong seenSet không
      return activeStories.some((story) => !seenSet.has(story.id.toString()));
    } catch (error) {
      this.logger.error(
        `Error in hasUnseenStory for user ${userId} and viewer ${viewerId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * 🔔 THÔNG BÁO REALTIME CHO BẠN BÈ KHI CÓ THAY ĐỔI STORY
   */
  private async notifyStoryUpdate(userId: string) {
    try {
      // 1. Luôn query DB để lấy trạng thái mới nhất (không dùng cache cũ)
      const count = await this.prisma.stories.count({
        where: {
          user_id: BigInt(userId),
          expires_at: {
            gt: new Date(),
          },
        },
      });

      const has = count > 0;
      const cacheKey = `user:has_story:${userId}`;

      // 2. Force update Redis cache to ensure consistency
      await this.redis.set(cacheKey, has.toString(), 86400);

      // Lấy danh sách bạn bè
      const friendIds = await this.friends.getFriendIds(userId);
      const friendIdStrings = friendIds.map((id) => id.toString());

      // Lấy danh sách toàn bộ ID đang online từ Redis (một lần duy nhất)
      const allOnlineIds = await this.presence.getOnlineUserIds();

      // Tìm giao điểm: Chỉ lấy bạn bè đang online
      const onlineFriendIds = friendIdStrings.filter((id) =>
        allOnlineIds.includes(id),
      );

      const payload = {
        userId,
        hasStory: has,
        timestamp: new Date().toISOString(),
      };

      // Gửi event qua socket cho từng người bạn đang online
      onlineFriendIds.forEach((id) => {
        // Gửi tới room riêng của user (user_<id> hoặc <id>)
        console.log(`Notifying story update for user ${userId} to friend ${id}`);
        this.realtime.emitToUser(`user_${id}`, 'story_status_changed', payload);
        // this.realtime.emitToUser(id, 'story_status_changed', payload);
      });

      this.logger.log(`Notified story update for user ${userId} to ${onlineFriendIds.length} online friends (out of ${friendIds.length} total)`);
    } catch (error) {
      this.logger.error(`Failed to notify story update for user ${userId}:`, error);
    }
  }

  // 📸 TẠO STORY MỚI
  async createStory(
    userId: string,
    mediaUrl: string | undefined,
    mediaType: string,
  ) {
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

    const result = {
      id: story.id.toString(),
      user_id: story.user_id.toString(),
      media_url: story.media_url,
      media_type: story.media_type,
      expires_at: story.expires_at,
      created_at: story.created_at,
    };

    // Force update cache Redis ngay lập tức
    await this.redis.set(`user:has_story:${userId}`, 'true', 86400);

    // Xóa cache feed của bản thân và thông báo cho bạn bè
    await this.redis.del(`user:stories_feed:${userId}`);

    // Trigger realtime update
    this.notifyStoryUpdate(userId);

    return result;
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
      return { success: false, message: 'Story not found' };
    }

    if (story.user_id.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    await this.prisma.stories.delete({
      where: { id: BigInt(storyId) },
    });

    // Kiểm tra xem còn story nào không để update Redis
    const remainingCount = await this.prisma.stories.count({
      where: {
        user_id: BigInt(userId),
        expires_at: { gt: new Date() },
      },
    });

    const hasRemaining = remainingCount > 0;
    const cacheKey = `user:has_story:${userId}`;
    await this.redis.set(cacheKey, hasRemaining.toString(), 86400);

    // Thông báo cho bạn bè
    this.notifyStoryUpdate(userId);

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
    const { page: pageNumber, limit: limitNumber } = parsePaginationParams(
      page,
      limit,
    );

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
              media_url: true,
              media_type: true,
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
          latest_story_media_url: latestStory?.media_url || null,
          latest_story_media_type: latestStory?.media_type || null,
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

  /**
   * 👁️ Ghi lại lượt xem story
   */
  async viewStory(storyId: string, userId: string) {
    try {
      // 1. Ghi vào DB
      await this.prisma.story_views.upsert({
        where: {
          story_id_user_id: {
            story_id: BigInt(storyId),
            user_id: BigInt(userId),
          },
        },
        create: {
          story_id: BigInt(storyId),
          user_id: BigInt(userId),
        },
        update: {
          viewed_at: new Date(),
        },
      });

      // 2. Ghi vào Redis (Set) để kiểm tra nhanh
      const seenKey = `user:seen_stories:${userId}`;
      await this.redis.sadd(seenKey, storyId);

      // 3. Invalidate cache feed của chính mình vì trạng thái seen đã đổi
      await this.redis.del(`user:stories_feed:${userId}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error recording view for story ${storyId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 👥 Lấy danh sách người đã xem story (Dùng Cursor Pagination)
   * Chỉ chủ story mới có quyền xem
   */
  async getStoryViewers(
    storyId: string,
    ownerId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    // 1. Kiểm tra story và quyền sở hữu
    const story = await this.prisma.stories.findUnique({
      where: { id: BigInt(storyId) },
    });

    if (!story) {
      throw new Error('Story not found');
    }

    if (story.user_id.toString() !== ownerId) {
      throw new Error('Only the story owner can see the viewer list');
    }

    // 2. Query danh sách người xem
    const views = await this.prisma.story_views.findMany({
      where: {
        story_id: BigInt(storyId),
      },
      take: limit + 1,
      cursor: cursor
        ? {
          story_id_user_id: {
            story_id: BigInt(storyId),
            user_id: BigInt(cursor),
          },
        }
        : undefined,
      orderBy: {
        viewed_at: 'desc',
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    const hasMore = views.length > limit;

    const items = hasMore ? views.slice(0, limit) : views;

    if (hasMore) {
      nextCursor = items[items.length - 1].user_id.toString();
    }

    return {
      success: true,
      data: {
        items: items.map((v) => ({
          user_id: v.users.id.toString(),
          name: v.users.name,
          username: v.users.username,
          avatar_url: v.users.avatar_url,
          viewed_at: v.viewed_at,
        })),
        nextCursor,
      },
    };
  }

  /**
   * 📰 LẤY FEED STORIES (Bản tin Stories của bạn bè)
   * Tối ưu:
   * 1. Chỉ lấy story của bạn bè (DB)
   * 2. Cache TOÀN BỘ feed đã được sort (Redis)
   * 3. Phân trang trên dữ liệu đã cache/sort (Memory)
   */
  async getFriendStoriesFeed(
    currentUserId: string,
    page?: string | number,
    limit?: string | number,
  ) {
    const { page: pageNumber, limit: limitNumber } = parsePaginationParams(
      page,
      limit,
    );

    const cacheKey = `user:stories_feed:${currentUserId}`;
    const cloudName =
      process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME;

    let fullSortedFeed: any[] = [];

    // 1. Kiểm tra cache feed (Toàn bộ feed)
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        fullSortedFeed = JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(
        `Redis error in getFriendStoriesFeed for ${currentUserId}:`,
        err,
      );
    }

    // 2. Nếu miss cache, compute lại toàn bộ feed
    if (fullSortedFeed.length === 0) {
      // 2.1 Lấy danh sách friendId
      const friendIds = await this.friends.getFriendIds(currentUserId);
      const friendIdStrings = friendIds.map((id) => id.toString());
      const targetUserIds = [...friendIdStrings, currentUserId];

      // 2.2 Query stories từ DB (Chỉ lấy stories của friends và bản thân)
      const activeStories = await this.prisma.stories.findMany({
        where: {
          user_id: {
            in: targetUserIds.map((id) => BigInt(id)),
          },
          expires_at: { gt: new Date() },
        },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar_url: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // 2.3 Preload "seen" status từ Redis
      const seenKey = `user:seen_stories:${currentUserId}`;
      const seenStoryIds = await this.redis.smembers(seenKey);
      const seenSet = new Set(seenStoryIds);

      // 2.4 Group stories by User
      const userGroups = new Map<string, any>();

      activeStories.forEach((story) => {
        const storyIdStr = story.id.toString();
        const userIdStr = story.user_id.toString();
        const isViewed = seenSet.has(storyIdStr);

        if (!userGroups.has(userIdStr)) {
          userGroups.set(userIdStr, {
            user: {
              id: userIdStr,
              name: story.users.name,
              username: story.users.username,
              avatar_url: story.users.avatar_url,
            },
            has_unseen: false,
            latest_story_time: story.created_at,
            stories: [],
          });
        }

        const group = userGroups.get(userIdStr);
        if (!isViewed) group.has_unseen = true;

        if (
          story.created_at &&
          (!group.latest_story_time ||
            new Date(story.created_at) > new Date(group.latest_story_time))
        ) {
          group.latest_story_time = story.created_at;
        }

        const formattedStory: any = {
          id: storyIdStr,
          media_url: story.media_url,
          media_type: story.media_type,
          created_at: story.created_at,
          expires_at: story.expires_at,
          is_viewed: isViewed,
        };

        if (story.media_type === 'video' && cloudName) {
          formattedStory.streaming_url = `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${story.media_url}.m3u8`;
        }

        group.stories.push(formattedStory);
      });

      // 2.5 Sort: User có story chưa xem lên trước, sau đó theo thời gian mới nhất
      fullSortedFeed = Array.from(userGroups.values()).sort((a, b) => {
        if (a.has_unseen !== b.has_unseen) {
          return a.has_unseen ? -1 : 1;
        }
        const timeA = a.latest_story_time
          ? new Date(a.latest_story_time).getTime()
          : 0;
        const timeB = b.latest_story_time
          ? new Date(b.latest_story_time).getTime()
          : 0;
        return timeB - timeA;
      });

      // 2.6 Sort stories trong từng group: Cũ -> Mới
      fullSortedFeed.forEach((group) => {
        group.stories.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });

      // 2.7 Cache lại toàn bộ feed (5 phút)
      try {
        await this.redis.set(cacheKey, JSON.stringify(fullSortedFeed), 300);
      } catch (err) {
        this.logger.warn(`Failed to set cache in getFriendStoriesFeed:`, err);
      }
    }

    // 3. Áp dụng phân trang trên level User Groups (In-memory)
    const total = fullSortedFeed.length;
    const offset = (pageNumber - 1) * limitNumber;
    const paginatedItems = fullSortedFeed.slice(offset, offset + limitNumber);

    return {
      success: true,
      message: 'Friend stories feed grouped by user fetched successfully',
      data: {
        items: paginatedItems,
        pagination: createPaginationMeta(pageNumber, limitNumber, total),
      },
    };
  }
}
