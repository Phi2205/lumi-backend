import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => {
        // Ưu tiên đọc từ cookie, nếu không có thì đọc từ header
        return req.cookies?.refreshToken || 
               ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const token = req.cookies?.refreshToken || 
                  (req.headers.authorization ?? '').replace('Bearer ', '').trim();

    return { userId: payload.sub, refreshToken: token };
  }
}
