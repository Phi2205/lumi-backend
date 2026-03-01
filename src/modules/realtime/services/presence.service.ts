import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class PresenceService {
    private readonly logger = new Logger(PresenceService.name);
    private readonly PRESENCE_PREFIX = 'presence:user:';
    private readonly SOCKETS_PREFIX = 'presence:user_sockets:';
    private readonly LAST_ONLINE_PREFIX = 'presence:last_online:';
    private readonly HEARTBEAT_TTL = 60; // 60 giây TTL theo yêu cầu

    constructor(private readonly redisService: RedisService) { }

    /**
     * Đánh dấu người dùng là online
     * @returns boolean - true nếu đây là socket đầu tiên (vừa chuyển từ offline -> online)
     */
    async markOnline(userId: string, socketId: string): Promise<boolean> {
        try {
            const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
            const socketsKey = `${this.SOCKETS_PREFIX}${userId}`;
            const lastOnlineKey = `${this.LAST_ONLINE_PREFIX}${userId}`;

            // Kiểm tra xem trước đó có online không
            const wasOnline = await this.isOnline(userId);

            // 1. Lưu trạng thái online
            await this.redisService.set(presenceKey, 'online', this.HEARTBEAT_TTL);

            // 2. Thêm socket ID vào Redis Set
            await this.redisService.getClient().sadd(socketsKey, socketId);

            // 3. Cập nhật thời gian hoạt động cuối cùng
            await this.redisService.set(lastOnlineKey, new Date().toISOString());

            // 4. Set TTL cho sockets set
            await this.redisService.expire(socketsKey, this.HEARTBEAT_TTL * 2);

            this.logger.log(`User ${userId} joined with socket ${socketId}`);

            return !wasOnline; // Trả về true nếu trước đó offline
        } catch (error) {
            this.logger.error(`Error marking user ${userId} online: ${error.message}`);
            return false;
        }
    }

    /**
     * Đánh dấu người dùng là offline (khi 1 tab đóng)
     */
    async markOffline(userId: string, socketId: string): Promise<boolean> {
        try {
            const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
            const socketsKey = `${this.SOCKETS_PREFIX}${userId}`;
            const lastOnlineKey = `${this.LAST_ONLINE_PREFIX}${userId}`;

            // 1. Xóa socket cụ thể này khỏi list
            await this.redisService.getClient().srem(socketsKey, socketId);

            // 2. Cập nhật thời gian offline cuối cùng
            await this.redisService.set(lastOnlineKey, new Date().toISOString());

            // 3. Kiểm tra xem còn socket nào hoạt động không
            const remainingSocketsCount = await this.redisService.getClient().scard(socketsKey);

            if (remainingSocketsCount === 0) {
                await Promise.all([
                    this.redisService.del(presenceKey),
                    this.redisService.del(socketsKey)
                ]);
                this.logger.log(`User ${userId} is now fully offline`);
                return true;
            }

            return false;
        } catch (error) {
            this.logger.error(`Error marking user ${userId} offline: ${error.message}`);
            return false;
        }
    }

    /**
     * Xử lý heartbeat duy trì online status
     */
    async handleHeartbeat(userId: string): Promise<void> {
        try {
            const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
            const socketsKey = `${this.SOCKETS_PREFIX}${userId}`;
            const lastOnlineKey = `${this.LAST_ONLINE_PREFIX}${userId}`;

            // Làm mới TTL và cập nhật last online
            const isStillOnline = await this.redisService.expire(presenceKey, this.HEARTBEAT_TTL);

            if (!isStillOnline) {
                await this.redisService.set(presenceKey, 'online', this.HEARTBEAT_TTL);
            }

            await Promise.all([
                this.redisService.set(lastOnlineKey, new Date().toISOString()),
                this.redisService.expire(socketsKey, this.HEARTBEAT_TTL * 2)
            ]);

            this.logger.debug(`Presence heartbeat for user ${userId} refreshed`);
        } catch (error) {
            this.logger.error(`Error handling heartbeat for user ${userId}: ${error.message}`);
        }
    }

    /**
     * Kiểm tra xem user có đang online hay không
     */
    async isOnline(userId: string): Promise<boolean> {
        try {
            return await this.redisService.exists(`${this.PRESENCE_PREFIX}${userId}`);
        } catch (error) {
            this.logger.error(`Error checking status for user ${userId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Lấy thời gian hoạt động cuối cùng
     */
    async getLastOnline(userId: string): Promise<string | null> {
        try {
            return await this.redisService.get(`${this.LAST_ONLINE_PREFIX}${userId}`);
        } catch (error) {
            this.logger.error(`Error getting last online for user ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Lấy danh sách ID các user đang online
     */
    async getOnlineUserIds(): Promise<string[]> {
        try {
            const keys = await this.redisService.getClient().keys(`${this.PRESENCE_PREFIX}*`);
            return keys.map(key => key.replace(this.PRESENCE_PREFIX, ''));
        } catch (error) {
            this.logger.error(`Error listing online users: ${error.message}`);
            return [];
        }
    }
}
