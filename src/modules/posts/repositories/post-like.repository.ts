import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostLikeRepository {
  constructor(private prisma: PrismaService) {}

  async likePost(
    postId: bigint | number | string,
    userId: bigint | number | string,
  ) {
    const pId = BigInt(postId);
    const uId = BigInt(userId);

    return this.prisma.$transaction(async (tx) => {
      const like = await tx.post_likes.create({
        data: {
          post_id: pId,
          user_id: uId,
        },
      });

      await tx.posts.update({
        where: { id: pId },
        data: {
          like_count: {
            increment: 1,
          },
        },
      });

      return like;
    });
  }

  async unlikePost(
    postId: bigint | number | string,
    userId: bigint | number | string,
  ) {
    const pId = BigInt(postId);
    const uId = BigInt(userId);

    return this.prisma.$transaction(async (tx) => {
      const like = await tx.post_likes.delete({
        where: {
          post_id_user_id: {
            post_id: pId,
            user_id: uId,
          },
        },
      });

      await tx.posts.update({
        where: { id: pId },
        data: {
          like_count: {
            decrement: 1,
          },
        },
      });

      return like;
    });
  }
  async checkLike(
    postId: bigint | number | string,
    userId: bigint | number | string,
  ) {
    const pId = BigInt(postId);
    const uId = BigInt(userId);

    const like = await this.prisma.post_likes.findUnique({
      where: {
        post_id_user_id: {
          post_id: pId,
          user_id: uId,
        },
      },
    });

    return !!like;
  }

  async findLikesForPosts(
    userId: bigint | number | string,
    postIds: (bigint | number | string)[],
  ) {
    return this.prisma.post_likes.findMany({
      where: {
        user_id: BigInt(userId),
        post_id: { in: postIds.map((id) => BigInt(id)) },
      },
      select: {
        post_id: true,
      },
    });
  }

  async findLikesByPostId(
    postId: bigint | number | string,
    page: number = 1,
    limit: number = 20,
  ) {
    const pId = BigInt(postId);
    const skip = (page - 1) * limit;

    const [likes, total] = await this.prisma.$transaction([
      this.prisma.post_likes.findMany({
        where: { post_id: pId },
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
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post_likes.count({
        where: { post_id: pId },
      }),
    ]);

    return { likes, total };
  }
}
