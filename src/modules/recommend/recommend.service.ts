import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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
    ) {
        this.recommendServiceUrl = this.configService.get<string>('RECOMMEND_SERVICE_URL') ?? '';
        if (!this.recommendServiceUrl) {
            throw new Error('RECOMMEND_SERVICE_URL is not defined in environment variables');
        }

        this.internalSharedSecret = this.configService.get<string>('INTERNAL_SHARED_SECRET') ?? '';
        console.log(this.internalSharedSecret);
        if (!this.internalSharedSecret) {
            throw new Error('INTERNAL_SHARED_SECRET is not defined in environment variables');
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
            return response.data;
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
            return response.data;
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            throw error;
        }
    }

    // Example generic call if needed
    async callRecommendApi(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
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
                    data
                })
            );
            return response.data;
        } catch (error) {
            console.error(`Error calling Recommend API ${endpoint}:`, error);
            throw error;
        }
    }
}
