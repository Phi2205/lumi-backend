import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReelViewRepository {
    constructor(private prisma: PrismaService) { }

    async createMany(userId: bigint | number | string, reelIds: (bigint | number | string)[]) {
        const data = reelIds.map((reelId) => ({
            user_id: BigInt(userId),
            reel_id: BigInt(reelId),
        }));
        console.log("userId", userId)
        console.log("reelIds", reelIds)
        // Increment view counts for each reel
        await Promise.all(
            reelIds.map((reelId) =>
                this.prisma.reels.update({
                    where: { id: BigInt(reelId) },
                    data: { view_count: { increment: 1 } },
                }),
            ),
        );

        return this.prisma.reel_views.createMany({
            data,
            skipDuplicates: true,
        });
    }

    async findViewedReelIds(userId: bigint | number | string) {
        const views = await this.prisma.reel_views.findMany({
            where: { user_id: BigInt(userId) },
            select: { reel_id: true },
        });
        return views.map((v) => v.reel_id);
    }
}
