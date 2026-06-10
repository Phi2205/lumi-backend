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
