# Hướng dẫn triển khai Rate Limiting cho Lumi Backend

Tài liệu này hướng dẫn chi tiết cách thiết lập và sử dụng **Rate Limiting** (giới hạn tần suất gửi yêu cầu) trong dự án NestJS backend của Lumi để bảo vệ hệ thống khỏi các cuộc tấn công Brute-force, Spam API và DDoS.

---

## 1. Công nghệ sử dụng

Chúng ta sử dụng thư viện chính thống của NestJS:
* **`@nestjs/throttler`**: Quản lý logic rate limit.
* **`@nest-lab/throttler-storage-redis`**: Lưu trữ lượt truy cập (hit counters) vào Redis (hỗ trợ scale nhiều instance backend trên Render và tránh bị mất dữ liệu khi restart container).

---

## 2. Các bước thiết lập nhanh

### Bước 1: Cài đặt các package cần thiết
Chạy lệnh sau tại thư mục gốc của backend:

```bash
npm install @nestjs/throttler @nest-lab/throttler-storage-redis ioredis --legacy-peer-deps
```

---

### Bước 2: Cấu hình `trust proxy` trong `src/main.ts`
Do ứng dụng được deploy trên các Cloud Provider (như Render, Cloudflare) hoạt động như một reverse proxy, IP của client thực tế sẽ được chuyển tiếp qua header `X-Forwarded-For`. Nếu không cấu hình `trust proxy`, hệ thống sẽ chặn nhầm tất cả người dùng vì hệ thống hiểu tất cả request đều đến từ IP của proxy.

Mở file `src/main.ts` và chỉnh sửa:

```typescript
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express'; // 1. Import class này
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // 2. Định nghĩa ứng dụng với kiểu NestExpressApplication để gọi hàm .set()
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 3. Cho phép tin tưởng proxy đầu tiên (Render/Cloudflare)
  app.set('trust proxy', 1);

  // ... các cấu hình hiện tại khác ...
  
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
```

---

### Bước 3: Đăng ký ThrottlerModule trong `src/app.module.ts`
Cập nhật file `src/app.module.ts` để cấu hình module Throttler kết nối với Redis và thiết lập các ngưỡng giới hạn mặc định.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
// ... các imports khác ...

@Module({
  imports: [
    // ... các Modules khác ...

    // Cấu hình Rate Limit kết nối với Redis
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        let redisInstance: Redis;
        if (redisUrl) {
          // Xử lý loại bỏ dấu ngoặc kép thừa (nếu có) từ biến môi trường
          redisInstance = new Redis(redisUrl.replace(/["']/g, '').trim());
        } else {
          // Cấu hình local fallback
          redisInstance = new Redis({
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB') || 0,
          });
        }

        return {
          throttlers: [
            {
              name: 'short',     // Giới hạn chống spam nhanh
              ttl: 1000,         // 1 giây
              limit: 5,          // Tối đa 5 requests/giây
            },
            {
              name: 'medium',    // Giới hạn trung hạn
              ttl: 10000,        // 10 giây
              limit: 20,         // Tối đa 20 requests/10 giây
            },
            {
              name: 'long',      // Giới hạn dài hạn
              ttl: 60000,        // 1 phút
              limit: 100,        // Tối đa 100 requests/phút
            }
          ],
          storage: new ThrottlerStorageRedisService(redisInstance),
        };
      },
    }),
  ],
  providers: [
    AppService,
    // Đăng ký Guard toàn cục (Global Guard) để áp dụng cho mọi Endpoint
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

---

## 3. Cách áp dụng và tùy biến (Fine-tuning)

Sau khi cấu hình toàn cục, tất cả các route đều được bảo vệ. Ta có thể tùy chỉnh cụ thể cho từng API:

### A. Bỏ qua Rate Limit cho các API tin cậy
Sử dụng decorator `@SkipThrottle()` ở cấp Controller hoặc Route:

```typescript
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle() // Bỏ qua kiểm tra rate limit cho toàn bộ controller này
@Controller('webhook')
export class WebhookController {}

// Hoặc chỉ bỏ qua trên 1 API
@Get('health')
@SkipThrottle()
getHealth() {
  return { status: 'OK' };
}
```

### B. Ghi đè giới hạn (Override) cho API đặc biệt
Với các API quan trọng và dễ bị spam (Login, Register, Reset Password, OTP, Upload File), ta nên giảm giới hạn request:

```typescript
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {

  @Post('login')
  @Throttle({ 
    short: { limit: 2, ttl: 1000 },    // Tối đa 2 requests/giây
    long: { limit: 5, ttl: 60000 }     // Tối đa 5 lần thử/phút
  })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
```

---

## 4. Tùy chỉnh Phản hồi lỗi (Custom Error Response) & Phân loại định danh (User ID / IP)

Mặc định thư viện sẽ ném lỗi `Too Many Requests` với status `429` và định danh dựa trên IP. Để định danh linh hoạt theo **`user_id`** (nếu đã đăng nhập) và **`IP`** (nếu là khách vãng lai), đồng thời tùy biến định dạng JSON trả về của API, chúng ta tạo một Guard kế thừa:

File `src/common/guards/custom-throttler.guard.ts`:

```typescript
import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Tìm accessToken từ cookie hoặc Bearer Token ở Authorization header
    const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        // 2. Decode payload của JWT token để lấy userId (payload ở vị trí thứ 2 trong chuỗi JWT)
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
          const payload = JSON.parse(payloadJson);
          
          // sub chứa userId trong cấu hình JwtStrategy của ứng dụng
          if (payload && payload.sub) {
            return `user:${payload.sub}`;
          }
        }
      } catch (err) {
        // Fallback về IP nếu token bị lỗi hoặc không thể parse
      }
    }

    // 3. Nếu là khách chưa đăng nhập, rate limit theo IP của client
    return req.ip;
  }

  // Tùy biến thông điệp và mã lỗi trả về khi bị block
  protected throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: any): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
```

Sau đó đổi class sử dụng trong `AppModule` ở Bước 3:

```typescript
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

// Thay thế phần cấu hình APP_GUARD trong AppModule providers:
providers: [
  AppService,
  {
    provide: APP_GUARD,
    useClass: CustomThrottlerGuard,
  },
]
```
