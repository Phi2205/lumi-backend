import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService implements OnModuleInit {
    private readonly logger = new Logger('HealthCheck');

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        this.startSelfPing();
    }

    private startSelfPing() {
        const port = this.configService.get<number>('PORT') || 4000;
        // URL tự ping (ưu tiên biến môi trường RENDER_EXTERNAL_URL nếu có từ Render, hoặc tự định nghĩa SELF_URL)
        const selfUrl = this.configService.get<string>('RENDER_EXTERNAL_URL') || `http://localhost:${port}`;
        const healthUrl = `${selfUrl}/health`;

        // Gọi lần đầu sau 10 giây khi khởi động
        setTimeout(() => this.ping(healthUrl), 10000);

        // Sau đó gọi mỗi 5 phút (300,000 ms)
        setInterval(() => this.ping(healthUrl), 300000);
    }

    private async ping(url: string) {
        try {
            this.logger.log(`Pinging... ${url}`);
            const response = await axios.get(url);
            if (response.status === 200) {
                this.logger.log('Ping success! Backend is awake.');
            }
        } catch (error) {
            this.logger.error(`Ping failed: ${error.message}`);
        }
    }
}
