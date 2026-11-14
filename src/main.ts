process.loadEnvFile?.();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // پیکربندی سرو عمومی فایل‌های آپلودشده (محصولات، دسته‌ها، برندها) با هدر امنیتی nosniff
  const uploadDirName = process.env.UPLOAD_DIR || 'public-uploads';
  const uploadDir = path.resolve(process.cwd(), uploadDirName);
  fs.mkdirSync(uploadDir, { recursive: true });

  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
