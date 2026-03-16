import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PostRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo post (hỗ trợ tạo nhiều media thông qua relation post_media)
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
    return this.prisma.posts.create({
      data: {
        user_id: BigInt(data.user_id),
        content: data.content ?? null,
        ...(data.media?.length
          ? {
              post_media: {
                create: data.media.map((m, idx) => ({
                  media_url: m.media_url,
                  media_type: m.media_type,
                  order: m.order ?? idx,
                })),
              },
            }
          : {}),
      },
      include: {
        post_media: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Lấy post theo id
   */
  async findById(id: bigint | number | string) {
    return this.prisma.posts.findUnique({
      where: { id: BigInt(id) },
      include: {
        post_media: { orderBy: { order: 'asc' } },
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
  }

  /**
   * Lấy danh sách post của 1 user
   */
  async findByUserId(
    userId: bigint | number | string,
    skip?: number,
    take?: number,
  ) {
    return this.prisma.posts.findMany({
      where: { user_id: BigInt(userId) },
      include: { post_media: { orderBy: { order: 'asc' } } },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });
  }

  /**
   * Xóa post (cascade sẽ xóa post_media, comments, likes nếu FK onDelete: Cascade)
   */
  async delete(id: bigint | number | string) {
    return this.prisma.posts.delete({
      where: { id: BigInt(id) },
    });
  }

  async findUnseenPosts(
    userId: bigint | number | string,
    seenPostIds: (bigint | number | string)[],
    friendIds: (bigint | number | string)[],
    skip?: number,
    take?: number,
  ) {
    const formattedSeenPostIds = seenPostIds.map((id) => BigInt(id));
    const formattedFriendIds = friendIds.map((id) => BigInt(id));

    return this.prisma.posts.findMany({
      where: {
        id: { notIn: formattedSeenPostIds },
        user_id: { in: formattedFriendIds },
      },
      include: {
        post_media: { orderBy: { order: 'asc' } },
        users: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar_url: true,
          },
        },
        original_post: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar_url: true,
              },
            },
            post_media: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });
  }

  async countUnseenPosts(
    userId: bigint | number | string,
    seenPostIds: (bigint | number | string)[],
    friendIds: (bigint | number | string)[],
  ) {
    const formattedSeenPostIds = seenPostIds.map((id) => BigInt(id));
    const formattedFriendIds = friendIds.map((id) => BigInt(id));

    return this.prisma.posts.count({
      where: {
        id: { notIn: formattedSeenPostIds },
        user_id: { in: formattedFriendIds },
      },
    });
  }

  async incrementCommentCount(
    postId: bigint | number | string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx || this.prisma).posts.update({
      where: { id: BigInt(postId) },
      data: {
        comment_count: {
          increment: 1,
        },
      },
    });
  }

  async decrementCommentCount(
    postId: bigint | number | string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx || this.prisma).posts.update({
      where: { id: BigInt(postId) },
      data: {
        comment_count: {
          decrement: 1,
        },
      },
    });
  }

  /**
   * Chia sẻ một bài post — tạo post mới với original_post_id trỏ về bài gốc
   */
  async sharePost(
    data: {
      user_id: bigint | number | string;
      original_post_id: bigint | number | string;
      content?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx || this.prisma).posts.create({
      data: {
        user_id: BigInt(data.user_id),
        content: data.content ?? null,
        original_post_id: BigInt(data.original_post_id),
      },
      include: {
        users: {
          select: { id: true, username: true, name: true, avatar_url: true },
        },
        original_post: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar_url: true,
              },
            },
            post_media: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }

  /**
   * Lấy danh sách bài share của một user (posts có original_post_id != null)
   */
  async findSharedPostsByUserId(
    userId: bigint | number | string,
    skip?: number,
    take?: number,
  ) {
    return this.prisma.posts.findMany({
      where: {
        user_id: BigInt(userId),
        original_post_id: { not: null },
      },
      include: {
        users: {
          select: { id: true, username: true, name: true, avatar_url: true },
        },
        original_post: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar_url: true,
              },
            },
            post_media: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });
  }

  /**
   * Lấy tất cả bài đã share một bài gốc (theo original_post_id)
   */
  async findSharesByOriginalPostId(
    originalPostId: bigint | number | string,
    skip?: number,
    take?: number,
  ) {
    return this.prisma.posts.findMany({
      where: { original_post_id: BigInt(originalPostId) },
      include: {
        users: {
          select: { id: true, username: true, name: true, avatar_url: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });
  }

  /**
   * Lấy post kèm original post (nếu là bài share)
   */
  async findByIdWithOriginal(id: bigint | number | string) {
    return this.prisma.posts.findUnique({
      where: { id: BigInt(id) },
      include: {
        post_media: { orderBy: { order: 'asc' } },
        users: {
          select: { id: true, username: true, name: true, avatar_url: true },
        },
        original_post: {
          include: {
            users: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar_url: true,
              },
            },
            post_media: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }

  /**
   * Tăng share_count của bài gốc khi có người share
   */
  async incrementShareCount(
    postId: bigint | number | string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx || this.prisma).posts.update({
      where: { id: BigInt(postId) },
      data: { share_count: { increment: 1 } },
    });
  }

  /**
   * Giảm share_count khi bài share bị xóa
   */
  async decrementShareCount(
    postId: bigint | number | string,
    tx?: Prisma.TransactionClient,
  ) {
    return (tx || this.prisma).posts.update({
      where: { id: BigInt(postId) },
      data: {
        share_count: { decrement: 1 },
      },
    });
  }
}
