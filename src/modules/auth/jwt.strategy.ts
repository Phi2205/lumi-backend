import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { AuthRepository } from './auth.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authRepository: AuthRepository) {
    super({
      jwtFromRequest: (req: Request) => {
        // Ưu tiên đọc từ cookie, nếu không có thì đọc từ header
        return req.cookies?.accessToken || 
               ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: any) {
    // Lấy thông tin user từ database để có role mới nhất
    const user = await this.authRepository.findById(payload.sub);
    
    return { 
      userId: payload.sub, 
      email: payload.email,
      role: (user as any)?.role || 'user' // Include role trong req.user
    };
  }
}
