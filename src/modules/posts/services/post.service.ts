import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostRepository } from '../repositories/post.repository';
import { RedisService } from 'src/redis/redis.service';
import { FriendsService } from '../../friends/friends.service';
import { PostLikeRepository } from '../repositories/post-like.repository';

@Injectable()
export class PostService {
  constructor(
    private prisma: PrismaService,
    private postRepository: PostRepository,
    private redisService: RedisService,
    private friendsService: FriendsService,
    private postLikeRepository: PostLikeRepository,
  ) {}

  /**
   * Tạo post với transaction
   * Sử dụng cả 2 repository: PostsRepository và PostMediaRepository
   */
  async createPost(data: {
    user_id: bigint | number | string;
    content?: string | null;
    media?: Array<{
      media_url: string;
      media_type: string;
      order?: number;
    }>;
  }) {
    // Sử dụng Prisma transaction để đảm bảo tính nhất quán
    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo post và trả về luôn user (post_media sẽ được tạo ở bước 2)
      const post = await tx.posts.create({
        data: {
          user_id: BigInt(data.user_id),
          content: data.content ?? null,
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar_url: true,
            },
          },
        },
      });

      // 2. Nếu có media, tạo media bằng PostMediaRepository.createMany
      // Sử dụng transaction client để đảm bảo atomicity
      if (data.media && data.media.length > 0) {
        await tx.post_media.createMany({
          data: data.media.map((item, index) => ({
            post_id: post.id,
            media_url: item.media_url,
            media_type: item.media_type,
            order: item.order ?? index,
          })),
        });
      }

      // 3. Lấy media của post (createMany không return records)
      const media = await tx.post_media.findMany({
        where: { post_id: post.id },
        orderBy: { order: 'asc' },
      });

      return {
        success: true,
        message: 'Post created successfully',
        data: {
          id: post.id.toString(),
          user_id: post.user_id.toString(),
          content: post.content,
          created_at: post.created_at,
          user: {
            id: post.users.id.toString(),
            username: post.users.username,
            name: post.users.name,
            avatar_url: post.users.avatar_url,
          },
          post_media: media.map((m) => ({
            id: m.id.toString(),
            media_url: m.media_url,
            media_type: m.media_type,
            order: m.order,
            created_at: m.created_at,
          })),
        },
      };
    });
  }

  async markPostsAsSeen(postIds: (string | number)[], userId: string | number) {
    if (!postIds.length) return;
    const key = `user:${userId}:seen_posts`;
    const stringPostIds = postIds.map((id) => id.toString());
    await this.redisService.getClient().lpush(key, ...stringPostIds);
    await this.redisService.expire(key, 7 * 24 * 60 * 60);
  }

  async getUnseenPosts(userId: string | number, page = 1, limit = 10) {
    const key = `user:${userId}:seen_posts`;
    const seenPostIds = await this.redisService.getClient().lrange(key, 0, -1);
    const friendIds = await this.friendsService.getFriendIds(userId.toString());

    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const skip = (pageNumber - 1) * limitNumber;

    const [posts, total] = await Promise.all([
      this.postRepository.findUnseenPosts(
        BigInt(userId),
        seenPostIds.map((id) => BigInt(id)),
        friendIds,
        skip,
        limitNumber,
      ),
      this.postRepository.countUnseenPosts(
        BigInt(userId),
        seenPostIds.map((id) => BigInt(id)),
        friendIds,
      ),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    const likedPosts = await this.postLikeRepository.findLikesForPosts(
      userId,
      posts.map((p) => p.id),
    );

    const likedPostIds = new Set(likedPosts.map((lp) => lp.post_id.toString()));

    return {
      success: true,
      message: 'Get unseen posts successfully',
      data: {
        items: posts.map((post) => ({
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
          },
          post_media: post.post_media.map((m) => ({
            id: m.id.toString(),
            media_url: m.media_url,
            media_type: m.media_type,
            order: m.order,
          })),
          original_post: (post as any).original_post
            ? {
                id: (post as any).original_post.id.toString(),
                user_id: (post as any).original_post.user_id.toString(),
                content: (post as any).original_post.content,
                created_at: (post as any).original_post.created_at,
                like_count: (post as any).original_post.like_count || 0,
                comment_count: (post as any).original_post.comment_count || 0,
                share_count: (post as any).original_post.share_count || 0,
                user: {
                  id: (post as any).original_post.users.id.toString(),
                  username: (post as any).original_post.users.username,
                  name: (post as any).original_post.users.name,
                  avatar_url: (post as any).original_post.users.avatar_url,
                },
                post_media: (post as any).original_post.post_media.map((m: any) => ({
                  id: m.id.toString(),
                  media_url: m.media_url,
                  media_type: m.media_type,
                  order: m.order,
                })),
              }
            : null,
        })),
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
      },
    };
  }

  /**
   * Share một bài post — tạo post mới với original_post_id + tăng share_count bài gốc (atomic)
   */
  async sharePost(data: {
    user_id: bigint | number | string;
    original_post_id: bigint | number | string;
    content?: string | null;
  }) {
    // Kiểm tra bài gốc tồn tại
    const originalPost = await this.postRepository.findById(data.original_post_id);
    if (!originalPost) {
      throw new Error(`Post ${data.original_post_id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo bài share mới
      const sharedPost = await this.postRepository.sharePost(
        {
          user_id: data.user_id,
          original_post_id: data.original_post_id,
          content: data.content,
        },
        tx,
      );

      // 2. Tăng share_count của bài gốc
      await this.postRepository.incrementShareCount(data.original_post_id, tx);

      return {
        success: true,
        message: 'Post shared successfully',
        data: {
          id: sharedPost.id.toString(),
          user_id: sharedPost.user_id.toString(),
          content: sharedPost.content,
          created_at: sharedPost.created_at,
          user: {
            id: sharedPost.users.id.toString(),
            username: sharedPost.users.username,
            name: sharedPost.users.name,
            avatar_url: sharedPost.users.avatar_url,
          },
          original_post: sharedPost.original_post
            ? {
                id: sharedPost.original_post.id.toString(),
                user_id: sharedPost.original_post.user_id.toString(),
                content: sharedPost.original_post.content,
                created_at: sharedPost.original_post.created_at,
                like_count: sharedPost.original_post.like_count || 0,
                comment_count: sharedPost.original_post.comment_count || 0,
                share_count: sharedPost.original_post.share_count || 0,
                user: {
                  id: sharedPost.original_post.users.id.toString(),
                  username: sharedPost.original_post.users.username,
                  name: sharedPost.original_post.users.name,
                  avatar_url: sharedPost.original_post.users.avatar_url,
                },
                post_media: sharedPost.original_post.post_media.map((m) => ({
                  id: m.id.toString(),
                  media_url: m.media_url,
                  media_type: m.media_type,
                  order: m.order,
                })),
              }
            : null,
        },
      };
    });
  }

  /**
   * Lấy danh sách bài share của current user
   */
  async getSharedPostsByUser(
    userId: bigint | number | string,
    page = 1,
    limit = 10,
  ) {
    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const skip = (pageNumber - 1) * limitNumber;

    const posts = await this.postRepository.findSharedPostsByUserId(
      userId,
      skip,
      limitNumber,
    );

    return {
      success: true,
      message: 'Get shared posts successfully',
      data: {
        items: posts.map((post) => ({
          id: post.id.toString(),
          user_id: post.user_id.toString(),
          content: post.content,
          created_at: post.created_at,
          user: {
            id: post.users.id.toString(),
            username: post.users.username,
            name: post.users.name,
            avatar_url: post.users.avatar_url,
          },
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
                },
                post_media: post.original_post.post_media.map((m) => ({
                  id: m.id.toString(),
                  media_url: m.media_url,
                  media_type: m.media_type,
                  order: m.order,
                })),
              }
            : null,
        })),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          hasNextPage: posts.length === limitNumber,
        },
      },
    };
  }

  /**
   * Lấy danh sách người đã share một bài post
   */
  async getSharesByPost(
    originalPostId: bigint | number | string,
    page = 1,
    limit = 10,
  ) {
    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const skip = (pageNumber - 1) * limitNumber;

    const shares = await this.postRepository.findSharesByOriginalPostId(
      originalPostId,
      skip,
      limitNumber,
    );

    return {
      success: true,
      message: 'Get shares by post successfully',
      data: {
        items: shares.map((post) => ({
          id: post.id.toString(),
          user_id: post.user_id.toString(),
          content: post.content,
          created_at: post.created_at,
          user: {
            id: post.users.id.toString(),
            username: post.users.username,
            name: post.users.name,
            avatar_url: post.users.avatar_url,
          },
        })),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          hasNextPage: shares.length === limitNumber,
        },
      },
    };
  }
}
