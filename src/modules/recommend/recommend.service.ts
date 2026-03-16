import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { UsersService } from '../users/users.service';

export interface InteractionEvent {
  actor_user_id: number | string;
  target_user_id: number | string;
  event_type: string;
  timestamp?: string;
  value?: number;
  content_id?: number | string;
  session_id?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class RecommendService {
  private readonly recommendServiceUrl: string;
  private readonly internalSharedSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {
    this.recommendServiceUrl =
      this.configService.get<string>('RECOMMEND_SERVICE_URL') ?? '';
    if (!this.recommendServiceUrl) {
      throw new Error(
        'RECOMMEND_SERVICE_URL is not defined in environment variables',
      );
    }

    this.internalSharedSecret =
      this.configService.get<string>('INTERNAL_SHARED_SECRET') ?? '';
    console.log(this.internalSharedSecret);
    if (!this.internalSharedSecret) {
      throw new Error(
        'INTERNAL_SHARED_SECRET is not defined in environment variables',
      );
    }
  }

  async logEvent(event: InteractionEvent) {
    const url = `${this.recommendServiceUrl}/api/events`;
    console.log(url);
    const headers = {
      'x-internal-key': this.internalSharedSecret,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, event, { headers }),
      );
      return {
        success: true,
        message: 'Event logged successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error logging event to Recommend service:', error);
      // Non-blocking error handling might be preferred for logging,
      // but usually we want to know if it fails.
      // We'll throw for now.
      throw error;
    }
  }

  async getRecommendations(userId: string) {
    const url = `${this.recommendServiceUrl}/recommend/${userId}`;
    const headers = {
      'x-internal-key': this.internalSharedSecret,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );
      return {
        success: true,
        message: 'Recommendations fetched successfully',
        data: response.data,
      };
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  }

  async getRecommendUsers(
    userId: string,
    params: { k: number; window_days: number; neighbor_k: number },
  ) {
    const cacheKey = `recommend_users:${userId}:${params.k}:${params.window_days}:${params.neighbor_k}`;
    console.log("cacheKey", cacheKey);
    // 1. Try to get from cache
    let finalResult: any = null;
    try {
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        finalResult = JSON.parse(cachedData);
      }
    } catch (err) {
      console.warn('[RecommendService] Redis get failed', err);
    }

    if (!finalResult) {
      const url = `${this.recommendServiceUrl}/api/recommend-users/${userId}`;
      const headers = {
        'x-internal-key': this.internalSharedSecret,
      };

      try {
        const response = await firstValueFrom(
          this.httpService.get(url, { headers, params }),
        );

        const recommendData = response.data;
        if (
          !recommendData.recommendations ||
          !Array.isArray(recommendData.recommendations)
        ) {
          return {
            success: true,
            message: 'No recommendations found',
            data: recommendData,
          };
        }

        const userIds = recommendData.recommendations.map((rec: any) =>
          BigInt(rec.user_id),
        );

        const users = await this.prisma.users.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            username: true,
            name: true,
            avatar_url: true,
            bio: true,
          },
        });

        // Map users back to recommendations to maintain order and include scores
        const recommendationsWithDetails = recommendData.recommendations.map(
          (rec: any) => {
            const userDetail = users.find(
              (u) => u.id.toString() === rec.user_id.toString(),
            );
            return {
              ...rec,
              user: userDetail
                ? {
                    ...userDetail,
                    id: userDetail.id.toString(),
                  }
                : null,
            };
          },
        );

        finalResult = {
          ...recommendData,
          recommendations: recommendationsWithDetails,
        };

        // 2. Save to cache with 3 hours TTL (10800 seconds)
        // We save WITHOUT friend_status
        try {
          await this.redisService.set(
            cacheKey,
            JSON.stringify(finalResult),
            10800,
          );
        } catch (err) {
          console.warn('[RecommendService] Redis set failed', err);
        }
      } catch (error) {
        console.error('Error fetching user recommendations:', error);
        throw error;
      }
    }

    // 3. Compute friend_status (ALWAYS done, NOT cached)
    if (finalResult && finalResult.recommendations) {
      const updatedRecommendations = await Promise.all(
        finalResult.recommendations.map(async (rec: any) => {
          if (!rec.user) return rec;

          const friendStatus = await this.usersService.getFriendStatus(
            userId,
            rec.user.id,
          );

          return {
            ...rec,
            user: {
              ...rec.user,
              friend_status: friendStatus,
            },
          };
        }),
      );

      return {
        success: true,
        message: 'User recommendations fetched successfully',
        data: {
          ...finalResult,
          recommendations: updatedRecommendations,
        },
      };
    }

    return {
      success: true,
      message: 'User recommendations fetched successfully',
      data: finalResult,
    };
  }

  // Example generic call if needed
  async callRecommendApi(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
  ) {
    const url = `${this.recommendServiceUrl}/${endpoint}`;
    const headers = {
      'x-internal-key': this.internalSharedSecret,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url,
          method,
          headers,
          data,
        }),
      );
      return {
        success: true,
        message: 'API call successful',
        data: response.data,
      };
    } catch (error) {
      console.error(`Error calling Recommend API ${endpoint}:`, error);
      throw error;
    }
  }
}
