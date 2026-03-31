import { Injectable } from '@nestjs/common';
import { PostViewRepository } from '../repositories/post-view.repository';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class PostViewService {
    constructor(
        private postViewRepository: PostViewRepository,
        private redisService: RedisService,
    ) { }

    /**
     * Đánh dấu nhiều post là đã xem bởi user
     */
    async markAsSeen(postIds: (string | number)[], userId: string | number) {
        if (!postIds || postIds.length === 0) {
            return { success: true, message: 'No post IDs provided' };
        }

        // 1. Lưu vào PostgreSQL để đảm bảo persistence lâu dài
        await this.postViewRepository.createMany(userId, postIds);

        // 2. Lưu vào Redis để phục vụ truy vấn nhanh (như logic hiện tại của hệ thống)
        try {
            const key = `user:${userId}:seen_posts`;
            const stringPostIds = postIds.map((id) => id.toString());
            await this.redisService.getClient().lpush(key, ...stringPostIds);
            await this.redisService.expire(key, 7 * 24 * 60 * 60); // Hết hạn sau 7 ngày
        } catch (error) {
            console.error('Failed to sync seen posts to Redis:', error);
            // Vẫn tiếp tục vì đã lưu vào DB
        }

        return {
            success: true,
            message: `${postIds.length} posts marked as seen`
        };
    }

    /**
     * Lấy danh sách ID các bài post đã xem từ DB
     */
    async getViewedPostIds(userId: string | number) {
        const ids = await this.postViewRepository.findViewedPostIds(userId);
        return ids.map(id => id.toString());
    }
}
