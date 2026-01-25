import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HeaderCheckMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Kiểm tra các header cần thiết (có thể tùy chỉnh theo nhu cầu)
    // Ví dụ: kiểm tra content-type cho POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('content-type');
      if (!contentType && req.body && Object.keys(req.body).length > 0) {
        // Nếu có body nhưng không có content-type, có thể log warning
        // Nhưng không block request vì NestJS sẽ tự xử lý
      }
    }

    // Có thể thêm các kiểm tra header khác ở đây
    // Ví dụ: kiểm tra custom header
    // if (!req.headers['x-api-key']) {
    //   throw new BadRequestException('Missing X-API-Key header');
    // }

    next();
  }
}
