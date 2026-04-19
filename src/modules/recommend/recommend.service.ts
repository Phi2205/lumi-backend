import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from '../users/users.service';

export interface InteractionEvent {
  actor_user_id: number | string;
  target_user_id: number | string;
  event_type: string;
  timestamp?: string;
  value?: number;
  content_id?: number | string;
  session_id?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class RecommendService {
  private readonly recommendServiceUrl: string;
  private readonly internalSharedSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {
    this.recommendServiceUrl =
      this.configService.get<string>('RECOMMEND_SERVICE_URL') ?? '';
    if (!this.recommendServiceUrl) {
      throw new Error(
        'RECOMMEND_SERVICE_URL is not defined in environment variables',
      );
    }

    this.internalSharedSecret =
      this.configService.get<string>('INTERNAL_SHARED_SECRET') ?? '';
    if (!this.internalSharedSecret) {
      throw new Error(
        'INTERNAL_SHARED_SECRET is not defined in environment variables',
      );
    }
  }

  private isPrefetchingPosts = new Set<string>();
  private isPrefetchingReels = new Set<string>();

  async logEvent(event: InteractionEvent) {
    const url = `${this.recommendServiceUrl}/api/events`;
    console.log(url);
    const headers = {
      'x-internal-key': this.internalSharedSecret,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, event, { headers }),
      );
      return {
        success: true,
        message: 'Event logged successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error logging event to Recommend service:', error);
      // Non-blocking error handling might be preferred for logging,
      // but usually we want to know if it fails.
      // We'll throw for now.
      throw error;
    }
  }

  async getRecommendations(userId: string) {
    const url = `${this.recommendServiceUrl}/recommend/${userId}`;
    const headers = {
      'x-internal-key': this.internalSharedSecret,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );
      return {
        success: true,
        message: 'Recommendations fetched successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  }

  async getRecommendUsers(
    userId: string,
    params: { k: number; window_days: number; neighbor_k: number },
  ) {
    const cacheKey = `recommend_users:${userId}:${params.k}:${params.window_days}:${params.neighbor_k}`;
    console.log('cacheKey', cacheKey);
    // 1. Try to get from cache
    let finalResult: any = null;
    try {
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        finalResult = JSON.parse(cachedData);
      }
    } catch (err) {
      console.warn('[RecommendService] Redis get failed', err);
    }

    if (!finalResult) {
      const url = `${this.recommendServiceUrl}/api/recommend-users/${userId}`;
      const headers = {
        'x-internal-key': this.internalSharedSecret,
      };

      try {
        const response = await firstValueFrom(
          this.httpService.get(url, { headers, params }),
        );

        const recommendData = response.data;
        if (
          !recommendData.recommendations ||
          !Array.isArray(recommendData.recommendations)
        ) {
          return {
            success: true,
            message: 'No recommendations found',
            data: recommendData,
          };
        }

        const userIds = recommendData.recommendations.map((rec: any) =>
          BigInt(rec.user_id),
        );

        const users = await this.prisma.users.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            username: true,
            name: true,
            avatar_url: true,
            bio: true,
          },
        });

        // Map users back to recommendations to maintain order and include scores
        const recommendationsWithDetails = recommendData.recommendations.map(
          (rec: any) => {
            const userDetail = users.find(
              (u) => u.id.toString() === rec.user_id.toString(),
            );
            return {
              ...rec,
              user: userDetail
                ? {
                  ...userDetail,
                  id: userDetail.id.toString(),
                }
                : null,
            };
          },
        );

        finalResult = {
          ...recommendData,
          recommendations: recommendationsWithDetails,
        };

        // 2. Save to cache with 3 hours TTL (10800 seconds)
        // We save WITHOUT friend_status
        try {
          await this.redisService.set(
            cacheKey,
            JSON.stringify(finalResult),
            10800,
          );
        } catch (err) {
          console.warn('[RecommendService] Redis set failed', err);
        }
      } catch (error) {
        console.error('Error fetching user recommendations:', error);
        throw error;
      }
    }

    // 3. Compute friend_status (ALWAYS done, NOT cached)
    if (finalResult && finalResult.recommendations) {
      const updatedRecommendations = await Promise.all(
        finalResult.recommendations.map(async (rec: any) => {
          if (!rec.user) return rec;

          const [friendStatus, hasStory] = await Promise.all([
            this.usersService.getFriendStatus(userId, rec.user.id),
            this.hasStory(rec.user.id),
          ]);

          return {
            ...rec,
            user: {
              ...rec.user,
              friend_status: friendStatus,
              hasStory: hasStory,
            },
          };
        }),
      );

      return {
        success: true,
        message: 'User recommendations fetched successfully',
        data: {
          ...finalResult,
          recommendations: updatedRecommendations,
        },
      };
    }

    return {
      success: true,
      message: 'User recommendations fetched successfully',
      data: finalResult,
    };
  }

  async getRecommendedPosts(userId: string, limit: number = 10): Promise<any> {
    const queueKey = `recommend_queue:${userId}`;
    const redis = this.redisService.getClient();

    // 1. Lấy danh sách recommend hiện tại trong Redis và parse dữ liệu
    const fetchQueue = async () => {
      const raw = await redis.lrange(queueKey, 0, -1);
      return raw.map(item => {
        try {
          const parsed = JSON.parse(item);
          return { id: parsed.id, seen: !!parsed.seen };
        } catch {
          return { id: item, seen: false };
        }
      });
    };

    let queue = await fetchQueue();
    let unseen = queue.filter(q => !q.seen);

    // 2. Logic điều phối: Cold Start (đợi sync) vs Low Queue (chạy ngầm)
    const PREFETCH_THRESHOLD = 20;

    if (unseen.length === 0) {
      // COLD START: Đợi lấy dữ liệu để tránh trả về rỗng. Ưu tiên Social -> CF -> Trending.
      await this.prefetchRecommendedPosts(userId, 'social_only');
      queue = await fetchQueue();
      unseen = queue.filter((q) => !q.seen);

      // Nếu không đủ (theo limit) thì lấy thêm CF
      if (unseen.length < limit) {
        await this.prefetchRecommendedPosts(userId, 'cf_only');
        queue = await fetchQueue();
        unseen = queue.filter((q) => !q.seen);
      }

      // Nếu vẫn trống (hết hàng đợi hoàn toàn) thì fallback Trending
      if (unseen.length === 0) {
        await this.prefetchRecommendedPosts(userId, 'trending_only');
        queue = await fetchQueue();
        unseen = queue.filter((q) => !q.seen);
      }
    } else if (unseen.length < PREFETCH_THRESHOLD) {
      // LOW QUEUE: Trả về kết quả hiện có ngay, nhưng nạp thêm cho lần sau trong background
      this.prefetchRecommendedPosts(userId, 'multi_source').catch((err) =>
        console.error(
          '[getRecommendedPosts] Background prefetch failed:',
          err.message,
        ),
      );
    }

    // 3. Trả về danh sách post
    if (unseen.length > 0) {
      const selected = unseen.slice(0, limit);
      const selectedIds = selected.map((s) => s.id);

      // Lấy thông tin chi tiết các bài post và kiểm tra like của user song song
      const [posts, userLikes] = await Promise.all([
        this.prisma.posts.findMany({
          where: { id: { in: selectedIds.map((id) => BigInt(id)) } },
          include: {
            users: { select: { id: true, username: true, name: true, avatar_url: true } },
            post_media: true,
            original_post: {
              include: {
                users: { select: { id: true, username: true, name: true, avatar_url: true } },
                post_media: true,
              },
            },
          },
        }),
        this.prisma.post_likes.findMany({
          where: {
            user_id: BigInt(userId),
            post_id: { in: selectedIds.map((id) => BigInt(id)) },
          },
          select: { post_id: true },
        }),
      ]);

      const likedPostIds = new Set(userLikes.map((l) => l.post_id.toString()));
      const postsMap = new Map(posts.map((p) => [p.id.toString(), p]));

      // Thu thập userId để batch story status
      const userIdsToCheck = new Set<string>();
      posts.forEach(post => {
        if (post.users?.id) userIdsToCheck.add(post.users.id.toString());
        if (post.original_post?.users?.id) userIdsToCheck.add(post.original_post.users.id.toString());
      });

      const storyStatusesArray = await Promise.all(
        Array.from(userIdsToCheck).map(async id => ({ id, hasStory: await this.hasStory(id) }))
      );
      const storyStatusMap = new Map(storyStatusesArray.map(s => [s.id, s.hasStory]));

      const orderedPosts = selectedIds.map((id) => {
        const post = postsMap.get(id);
        if (!post) return null;

        return {
          id: post.id.toString(),
          user_id: post.user_id.toString(),
          content: post.content,
          created_at: post.created_at,
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          share_count: post.share_count || 0,
          has_liked: likedPostIds.has(post.id.toString()),
          user: {
            id: post.users.id.toString(),
            username: post.users.username,
            name: post.users.name,
            avatar_url: post.users.avatar_url,
            has_story: storyStatusMap.get(post.users.id.toString()) || false,
          },
          post_media: post.post_media.map((m) => ({
            id: m.id.toString(),
            media_url: m.media_url,
            media_type: m.media_type,
            order: m.order,
          })),
          original_post: post.original_post
            ? {
              id: post.original_post.id.toString(),
              user_id: post.original_post.user_id.toString(),
              content: post.original_post.content,
              created_at: post.original_post.created_at,
              like_count: post.original_post.like_count || 0,
              comment_count: post.original_post.comment_count || 0,
              share_count: post.original_post.share_count || 0,
              user: {
                id: post.original_post.users.id.toString(),
                username: post.original_post.users.username,
                name: post.original_post.users.name,
                avatar_url: post.original_post.users.avatar_url,
                hasStory: storyStatusMap.get(post.original_post.users.id.toString()) || false,
              },
              post_media: post.original_post.post_media.map((m) => ({
                id: m.id.toString(),
                media_url: m.media_url,
                media_type: m.media_type,
                order: m.order,
              })),
            }
            : null,
        };
      }).filter((p) => p !== null);

      return {
        success: true,
        message: 'Recommended posts fetched successfully',
        data: orderedPosts,
      };
    }

    return {
      success: true,
      message: 'No recommended posts found',
      data: [],
    };
  }

  /**
   * Prefetch candidates từ Recommend Service (Sync hoặc Async tùy trường hợp)
   */
  private async prefetchRecommendedPosts(userId: string, strategy: string = 'multi_source') {
    if (this.isPrefetchingPosts.has(userId)) return;
    this.isPrefetchingPosts.add(userId);

    const queueKey = `recommend_queue:${userId}`;
    const historyKey = `recommend_history:${userId}`;
    const redis = this.redisService.getClient();
    const TTL = 3600;

    try {
      // Lấy views và history để loại trừ
      const [views, historyIds, currentQueueRaw] = await Promise.all([
        this.prisma.post_views.findMany({
          where: { user_id: BigInt(userId) },
          select: { post_id: true },
        }),
        redis.smembers(historyKey),
        redis.lrange(queueKey, 0, -1),
      ]);

      const allViewedIdsSet = new Set(views.map((v) => v.post_id.toString()));
      const currentQueueIds = new Set(currentQueueRaw.map(item => {
        try { return JSON.parse(item).id; } catch { return item; }
      }));

      const excludeIds = Array.from(new Set([...historyIds, ...allViewedIdsSet, ...currentQueueIds]));
      const excludeString = excludeIds.join(',').substring(0, 4000);

      const response = await firstValueFrom(
        this.httpService.get(`${this.recommendServiceUrl}/api/recommend-posts/${userId}`, {
          headers: { 'x-internal-key': this.internalSharedSecret },
          params: {
            k: 100,
            window_days: 30,
            strategy: strategy,
            exclude_ids: excludeString,
          },
        }),
      );

      const candidates = response.data.candidates || [];
      const newIds = candidates
        .map((p: any) => p.post_id.toString())
        .filter(id => !currentQueueIds.has(id));

      if (newIds.length > 0) {
        await redis.sadd(historyKey, ...newIds);
        await redis.expire(historyKey, TTL);

        // Map candidate thành dạng entry lưu vào queue
        const newEntries = newIds.map((id) => ({
          id,
          seen: allViewedIdsSet.has(id),
        }));

        await redis.pipeline()
          .rpush(queueKey, ...newEntries.map((q) => JSON.stringify(q)))
          .expire(queueKey, TTL)
          .exec();
      }
    } catch (error) {
      console.error('[prefetchRecommendedPosts] Error prefetching recommendations:', error.message);
    } finally {
      this.isPrefetchingPosts.delete(userId);
    }
  }

  async syncSeenStatusInQueue(userId: string, targetPostIds: string[]) {
    const queueKey = `recommend_queue:${userId}`;
    const redis = this.redisService.getClient();
    const TTL = 3600;

    const rawQueue = await redis.lrange(queueKey, 0, -1);
    if (rawQueue.length === 0) return;

    let modified = false;
    const targetSet = new Set(targetPostIds);
    const updatedQueue = rawQueue.map((item) => {
      try {
        const parsed = JSON.parse(item);
        if (targetSet.has(parsed.id) && !parsed.seen) {
          modified = true;
          return JSON.stringify({ ...parsed, seen: true });
        }
        return item;
      } catch {
        // Fallback for non-JSON strings (if any)
        if (targetSet.has(item)) {
          modified = true;
          return JSON.stringify({ id: item, seen: true });
        }
        return item;
      }
    });

    if (modified) {
      await redis.pipeline()
        .del(queueKey)
        .rpush(queueKey, ...updatedQueue)
        .expire(queueKey, TTL)
        .exec();
    }
  }

  async getRecommendedReels(userId: string, limit: number = 10): Promise<any> {
    const queueKey = `recommend_reels_queue:${userId}`;
    const redis = this.redisService.getClient();

    const fetchQueue = async () => {
      const raw = await redis.lrange(queueKey, 0, -1);
      return raw.map(item => {
        try {
          const parsed = JSON.parse(item);
          return { id: parsed.id, seen: !!parsed.seen };
        } catch {
          return { id: item, seen: false };
        }
      });
    };

    let queue = await fetchQueue();
    let unseen = queue.filter(q => !q.seen);

    // 2. Logic điều phối
    const PREFETCH_THRESHOLD = 20;

    if (unseen.length === 0) {
      await this.prefetchRecommendedReels(userId);
      queue = await fetchQueue();
      unseen = queue.filter(q => !q.seen);
    } else if (unseen.length < PREFETCH_THRESHOLD) {
      this.prefetchRecommendedReels(userId).catch(err =>
        console.error('[getRecommendedReels] Background prefetch failed:', err.message)
      );
    }

    // 3. Trả về danh sách reels
    if (unseen.length > 0) {
      const selected = unseen.slice(0, limit);
      const selectedIds = selected.map((s) => s.id);

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;

      // Lấy thông tin chi tiết các bài reels và kiểm tra like của user song song
      const [reels, userLikes] = await Promise.all([
        this.prisma.reels.findMany({
          where: { id: { in: selectedIds.map((id) => BigInt(id)) } },
          include: {
            user: { select: { id: true, username: true, name: true, avatar_url: true } },
          },
        }),
        this.prisma.reel_likes.findMany({
          where: {
            user_id: BigInt(userId),
            reel_id: { in: selectedIds.map((id) => BigInt(id)) },
          },
          select: { reel_id: true },
        }),
      ]);

      const likedReelIds = new Set(userLikes.map((l) => l.reel_id.toString()));
      const reelsMap = new Map(reels.map((r) => [r.id.toString(), r]));

      // Thu thập userIds để batch stories
      const userIdsToCheck = new Set<string>();
      reels.forEach(reel => {
        if (reel.user?.id) userIdsToCheck.add(reel.user.id.toString());
      });

      const storyStatusesArray = await Promise.all(
        Array.from(userIdsToCheck).map(async id => ({ id, hasStory: await this.hasStory(id) }))
      );
      const storyStatusMap = new Map(storyStatusesArray.map(s => [s.id, s.hasStory]));

      const orderedReels = selectedIds.map((id) => {
        const reel = reelsMap.get(id);
        if (!reel) return null;

        return {
          id: reel.id.toString(),
          user_id: reel.user_id.toString(),
          video_url: reel.video_url,
          public_id: reel.public_id,
          thumbnail_url: reel.thumbnail_url,
          caption: reel.caption,
          music_name: reel.music_name,
          duration: reel.duration,
          like_count: reel.like_count || 0,
          comment_count: reel.comment_count || 0,
          share_count: reel.share_count || 0,
          view_count: reel.view_count || 0,
          created_at: reel.created_at,
          has_liked: likedReelIds.has(reel.id.toString()),
          user: {
            id: reel.user.id.toString(),
            username: reel.user.username,
            name: reel.user.name,
            avatar_url: reel.user.avatar_url,
            has_story: storyStatusMap.get(reel.user.id.toString()) || false,
          },
          streaming_url: cloudName
            ? `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${reel.public_id}.m3u8`
            : null,
        };
      }).filter((r) => r !== null);

      return {
        success: true,
        message: 'Recommended reels fetched successfully',
        data: orderedReels,
      };
    }

    return {
      success: true,
      message: 'No recommended reels found',
      data: [],
    };
  }

  /**
   * Prefetch candidates cho Reels
   */
  private async prefetchRecommendedReels(userId: string) {
    if (this.isPrefetchingReels.has(userId)) return;
    this.isPrefetchingReels.add(userId);

    const queueKey = `recommend_reels_queue:${userId}`;
    const historyKey = `recommend_reels_history:${userId}`;
    const redis = this.redisService.getClient();
    const TTL = 3600;

    try {
      const [views, historyIds, currentQueueRaw] = await Promise.all([
        this.prisma.reel_views.findMany({
          where: { user_id: BigInt(userId) },
          select: { reel_id: true },
        }),
        redis.smembers(historyKey),
        redis.lrange(queueKey, 0, -1),
      ]);

      const allViewedIdsSet = new Set(views.map((v) => v.reel_id.toString()));
      const currentQueueIds = new Set(currentQueueRaw.map(item => {
        try { return JSON.parse(item).id; } catch { return item; }
      }));

      const excludeIds = Array.from(new Set([...historyIds, ...allViewedIdsSet, ...currentQueueIds]));
      const excludeString = excludeIds.join(',').substring(0, 4000);

      const response = await firstValueFrom(
        this.httpService.get(`${this.recommendServiceUrl}/api/recommend-reels/${userId}`, {
          headers: { 'x-internal-key': this.internalSharedSecret },
          params: {
            k: 100,
            window_days: 30,
            strategy: 'multi_source',
            exclude_ids: excludeString,
          },
        }),
      );

      const candidates = response.data.candidates || [];
      const newIds = candidates
        .map((r: any) => r.reel_id.toString())
        .filter(id => !currentQueueIds.has(id));

      if (newIds.length > 0) {
        await redis.sadd(historyKey, ...newIds);
        await redis.expire(historyKey, TTL);

        const newEntries = newIds.map((id) => ({
          id,
          seen: allViewedIdsSet.has(id),
        }));

        await redis.pipeline()
          .rpush(queueKey, ...newEntries.map((q) => JSON.stringify(q)))
          .expire(queueKey, TTL)
          .exec();
      }
    } catch (error) {
      console.error('[prefetchRecommendedReels] Error prefetching recommendations:', error.message);
    } finally {
      this.isPrefetchingReels.delete(userId);
    }
  }

  async syncSeenReelsStatusInQueue(userId: string, targetReelIds: string[]) {
    const queueKey = `recommend_reels_queue:${userId}`;
    const redis = this.redisService.getClient();
    const TTL = 3600;

    const rawQueue = await redis.lrange(queueKey, 0, -1);
    if (rawQueue.length === 0) return;

    let modified = false;
    const targetSet = new Set(targetReelIds);
    const updatedQueue = rawQueue.map((item) => {
      try {
        const parsed = JSON.parse(item);
        if (targetSet.has(parsed.id) && !parsed.seen) {
          modified = true;
          return JSON.stringify({ ...parsed, seen: true });
        }
        return item;
      } catch {
        if (targetSet.has(item)) {
          modified = true;
          return JSON.stringify({ id: item, seen: true });
        }
        return item;
      }
    });

    if (modified) {
      await redis.pipeline()
        .del(queueKey)
        .rpush(queueKey, ...updatedQueue)
        .expire(queueKey, TTL)
        .exec();
    }
  }

  async clearRecommendCache(userId: string) {
    const queueKey = `recommend_queue:${userId}`;
    const historyKey = `recommend_history:${userId}`;
    const redis = this.redisService.getClient();

    await redis.del(queueKey, historyKey);

    return {
      success: true,
      message: 'Recommendation cache cleared successfully',
    };
  }

  // Example generic call if needed
  async callRecommendApi(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
  ) {
    const url = `${this.recommendServiceUrl}/${endpoint}`;
    const headers = {
      'x-internal-key': this.internalSharedSecret,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url,
          method,
          headers,
          data,
        }),
      );
      return {
        success: true,
        message: 'API call successful',
        data: response.data,
      };
    } catch (error) {
      console.error(`Error calling Recommend API ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * 🔍 KIỂM TRA USER CÓ STORY ACTIVE KHÔNG (Sao chép từ StoriesService để tránh circular dependency)
   */
  private async hasStory(userId: string): Promise<boolean> {
    const cacheKey = `user:has_story:${userId}`;

    try {
      // 1. Kiểm tra trong Redis cache
      const cached = await this.redisService.get(cacheKey);
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
      await this.redisService.set(cacheKey, has.toString(), 86400);

      return has;
    } catch (error) {
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
}
