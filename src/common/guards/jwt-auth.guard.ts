import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RedisService } from '../../redis/redis.service';
import { firstValueFrom, Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Kiểm tra xem route có được đánh dấu là public không
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu là public route, bỏ qua authentication
    if (isPublic) {
      return true;
    }

    // Check blacklist trước khi verify token
    const request = context.switchToHttp().getRequest();
    const token =
      request.cookies?.accessToken ||
      request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const isBlacklisted = await this.redisService.get(
        `blacklist:access:${token}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // Nếu không phải public, thực hiện JWT authentication
    const result = super.canActivate(context);

    // Handle different return types
    if (result instanceof Promise) {
      return result;
    }

    if (result instanceof Observable) {
      return firstValueFrom(result);
    }

    // Boolean case
    return Promise.resolve(result);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Xử lý các trường hợp lỗi
    if (err || !user) {
      // Log thông tin lỗi nếu cần
      if (info) {
        console.error('JWT Auth Error:', info.message || info);
      }

      throw err || new UnauthorizedException('Invalid or expired token');
    }

    // Trả về user nếu authentication thành công
    return user;
  }
}
