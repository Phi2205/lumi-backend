import { Injectable } from '@nestjs/common';
import { ReelViewRepository } from '../repositories/reel-view.repository';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class ReelViewService {
    constructor(
        private reelViewRepository: ReelViewRepository,
        private redisService: RedisService,
    ) { }

    /**
     * Đánh dấu nhiều reel là đã xem bởi user
     */
    async markAsSeen(reelIds: (string | number)[], userId: string | number) {
        if (!reelIds || reelIds.length === 0) {
            return { success: true, message: 'No reel IDs provided' };
        }

        // 1. Lưu vào PostgreSQL để đảm bảo persistence lâu dài
        await this.reelViewRepository.createMany(userId, reelIds);

        // 2. Lưu vào Redis để phục vụ truy vấn nhanh (như logic hiện tại của hệ thống)
        try {
            const key = `user:${userId}:seen_reels`;
            const stringReelIds = reelIds.map((id) => id.toString());
            await this.redisService.getClient().sadd(key, ...stringReelIds);
            await this.redisService.expire(key, 7 * 24 * 60 * 60); // Hết hạn sau 7 ngày
        } catch (error) {
            console.error('Failed to sync seen reels to Redis:', error);
        }

        return {
            success: true,
            message: `${reelIds.length} reels marked as seen`,
        };
    }

    /**
     * Lấy danh sách ID các bài reel đã xem từ DB
     */
    async getViewedReelIds(userId: string | number) {
        const ids = await this.reelViewRepository.findViewedReelIds(userId);
        return ids.map((id) => id.toString());
    }
}
