import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

// Load and override environment variables from .env so .env takes precedence
// over any system environment variables (useful for local development).
try {
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    for (const k of Object.keys(parsed)) {
      process.env[k] = parsed[k];
    }
  }
} catch (e) {
  // ignore errors reading .env
}
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parser
  app.use(cookieParser());

  app.enableCors({
    origin: true, // Cho phép tất cả origins (hoặc chỉ định domain cụ thể)
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
