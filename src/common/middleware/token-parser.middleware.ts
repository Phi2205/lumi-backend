import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenParserMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Parse token từ header hoặc cookie
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || 'dev-secret',
        });
        // Attach data vào request (nếu chưa có từ Passport)
        if (!req.user) {
          req.user = {
            userId: decoded.sub,
            email: decoded.email,
            role: decoded.role || 'user',
          };
        }
      } catch (error) {
        // Token invalid, nhưng không throw error để cho guard xử lý
        // Chỉ log nếu cần debug
        if (process.env.NODE_ENV === 'development') {
          // Silent fail - let guards handle authentication
        }
      }
    }

    next();
  }
}
