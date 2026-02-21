import './env-loader'; // Must be first!
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parser
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONT_END_URL, // Cho phép tất cả origins (hoặc chỉ định domain cụ thể)
    credentials: true, // Cho phép gửi cookies
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // chỉ cho phép field có trong DTO
      forbidNonWhitelisted: true, // gửi field dư → lỗi
      transform: true, // auto convert type
    }),
  );

  // Global interceptor để đo thời gian request
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Lumi API')
    .setDescription('API documentation for Lumi Backend')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
    })
    .addCookieAuth('refreshToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refreshToken',
    })
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  });

  await app.listen(process.env.PORT || 4000);
  console.log(`🚀 Server is running on: http://localhost:${process.env.PORT || 4000}`);
  console.log(`📚 Swagger API docs: http://localhost:${process.env.PORT || 4000}/docs`);
}
bootstrap();
