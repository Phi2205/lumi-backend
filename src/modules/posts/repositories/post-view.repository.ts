import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostViewRepository {
    constructor(private prisma: PrismaService) { }

    async createMany(userId: bigint | number | string, postIds: (bigint | number | string)[]) {
        const data = postIds.map((postId) => ({
            user_id: BigInt(userId),
            post_id: BigInt(postId),
        }));

        return this.prisma.post_views.createMany({
            data,
            skipDuplicates: true,
        });
    }

    async findViewedPostIds(userId: bigint | number | string) {
        const views = await this.prisma.post_views.findMany({
            where: { user_id: BigInt(userId) },
            select: { post_id: true },
        });
        return views.map((v) => v.post_id);
    }
}
