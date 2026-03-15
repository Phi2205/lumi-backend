import { Injectable } from '@nestjs/common';
import { ReelLikeRepository } from '../repositories/reel-like.repository';

@Injectable()
export class ReelLikeService {
    constructor(private reelLikeRepository: ReelLikeRepository) { }

    async toggleLike(reelId: bigint | number | string, userId: bigint | number | string) {
        const hasLiked = await this.reelLikeRepository.checkLike(reelId, userId);

        if (hasLiked) {
            await this.reelLikeRepository.unlikeReel(reelId, userId);
            return { status: 'unliked' };
        } else {
            await this.reelLikeRepository.likeReel(reelId, userId);
            return { status: 'liked' };
        }
    }

    async getLikesByReelId(
        reelId: bigint | number | string,
        cursor?: string,
        limit: number = 20,
    ) {
        const { likes } = await this.reelLikeRepository.findLikesByReelId(reelId, cursor, limit);

        const data = likes.map((like) => ({
            reel_id: like.reel_id.toString(),
            user_id: like.user_id.toString(),
            user: like.user
                ? {
                    id: like.user.id.toString(),
                    name: like.user.name,
                    avatar_url: like.user.avatar_url,
                }
                : null,
        }));

        const nextCursor =
            likes.length === limit ? likes[likes.length - 1].user_id.toString() : null;

        return {
            success: true,
            message: 'Get likes successfully',
            data: {
                items: data,
                nextCursor,
                hasMore: likes.length === limit,
            },
        };
    }
}
