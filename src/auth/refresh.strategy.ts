import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const token = (req.headers.authorization ?? '')
      .replace('Bearer ', '')
      .trim();

    return { userId: payload.sub, refreshToken: token };
  }
}
