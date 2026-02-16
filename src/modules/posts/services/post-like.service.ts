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
}
