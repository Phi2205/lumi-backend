import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // chỉ cho phép field có trong DTO
      forbidNonWhitelisted: true, // gửi field dư → lỗi
      transform: true, // auto convert type
    }),
  );

  await app.listen(process.env.PORT || 4000);
}
bootstrap();
