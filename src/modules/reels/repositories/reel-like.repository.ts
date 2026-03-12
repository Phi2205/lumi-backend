import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReelLikeRepository {
    constructor(private prisma: PrismaService) { }

    async likeReel(reelId: bigint | number | string, userId: bigint | number | string) {
        const rId = BigInt(reelId);
        const uId = BigInt(userId);

        return this.prisma.$transaction(async (tx) => {
            const like = await tx.reel_likes.create({
                data: {
                    reel_id: rId,
                    user_id: uId,
                },
            });

            await tx.reels.update({
                where: { id: rId },
                data: {
                    like_count: {
                        increment: 1,
                    },
                },
            });

            return like;
        });
    }

    async unlikeReel(reelId: bigint | number | string, userId: bigint | number | string) {
        const rId = BigInt(reelId);
        const uId = BigInt(userId);

        return this.prisma.$transaction(async (tx) => {
            const like = await tx.reel_likes.delete({
                where: {
                    reel_id_user_id: {
                        reel_id: rId,
                        user_id: uId,
                    },
                },
            });

            await tx.reels.update({
                where: { id: rId },
                data: {
                    like_count: {
                        decrement: 1,
                    },
                },
            });

            return like;
        });
    }

    async checkLike(reelId: bigint | number | string, userId: bigint | number | string) {
        const rId = BigInt(reelId);
        const uId = BigInt(userId);

        const like = await this.prisma.reel_likes.findUnique({
            where: {
                reel_id_user_id: {
                    reel_id: rId,
                    user_id: uId,
                },
            },
        });

        return !!like;
    }

    async findLikesForReels(userId: bigint | number | string, reelIds: (bigint | number | string)[]) {
        return this.prisma.reel_likes.findMany({
            where: {
                user_id: BigInt(userId),
                reel_id: { in: reelIds.map((id) => BigInt(id)) },
            },
            select: {
                reel_id: true,
            },
        });
    }

    async findLikesByReelId(
        reelId: bigint | number | string,
        cursor?: string,
        limit: number = 20,
    ) {
        const rId = BigInt(reelId);

        const likes = await this.prisma.reel_likes.findMany({
            where: { reel_id: rId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        avatar_url: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
            take: limit,
            skip: cursor ? 1 : 0,
            cursor: cursor
                ? {
                    reel_id_user_id: {
                        reel_id: rId,
                        user_id: BigInt(cursor),
                    },
                }
                : undefined,
        });

        return { likes };
    }
}
