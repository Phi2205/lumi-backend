import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { HeaderCheckMiddleware } from './middleware/header-check.middleware';
import { TokenParserMiddleware } from './middleware/token-parser.middleware';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
    }),
    RedisModule,
  ],
  providers: [TokenParserMiddleware, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware, TokenParserMiddleware, HeaderCheckMiddleware)
      .forRoutes('*'); // Áp dụng cho tất cả routes
  }
}
