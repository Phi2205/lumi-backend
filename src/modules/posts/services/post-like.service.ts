import { Injectable } from '@nestjs/common';
import { PostLikeRepository } from '../repositories/post-like.repository';

@Injectable()
export class PostLikeService {
  constructor(private postLikeRepository: PostLikeRepository) {}

  async toggleLike(postId: bigint | number | string, userId: bigint | number | string) {
    const hasLiked = await this.postLikeRepository.checkLike(postId, userId);

    if (hasLiked) {
      await this.postLikeRepository.unlikePost(postId, userId);
      return { status: 'unliked' };
    } else {
      await this.postLikeRepository.likePost(postId, userId);
      return { status: 'liked' };
    }
  }

  async getLikesByPostId(
    postId: bigint | number | string,
    page: number = 1,
    limit: number = 20,
  ) {
    const { likes, total } = await this.postLikeRepository.findLikesByPostId(postId, page, limit);

    const data = likes.map((like) => ({
      post_id: like.post_id.toString(),
      user_id: like.user_id.toString(),
      user: like.users
        ? {
            id: like.users.id.toString(),
            name: like.users.name,
            avatar_url: like.users.avatar_url,
          }
        : null,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Get likes successfully',
      data: {
        items: data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }
}
