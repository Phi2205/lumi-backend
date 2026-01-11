import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => {
        // Ưu tiên đọc từ cookie, nếu không có thì đọc từ header
        return req.cookies?.accessToken || 
               ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  validate(payload: any) {
    return { userId: payload.sub, email: payload.email };
  }
}
