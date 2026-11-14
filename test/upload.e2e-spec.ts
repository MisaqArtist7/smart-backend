import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../src/generated/prisma/client.js';

describe('Admin Upload Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const testUploadDir = 'test-uploads-e2e';
  const fullTestUploadDir = path.resolve(process.cwd(), testUploadDir);

  let adminToken: string;
  let userToken: string;

  const mockUsers = [
    {
      id: 1,
      phone: '09120000001',
      name: 'مدیر سیستم',
      role: Role.ADMIN,
      isActive: true,
    },
    {
      id: 2,
      phone: '09120000002',
      name: 'کاربر عادی',
      role: Role.USER,
      isActive: true,
    },
  ];

  const mockPrisma = {
    user: {
      findUnique: async ({ where }: any) => {
        return mockUsers.find((u) => u.id === where.id) || null;
      },
    },
  };

  beforeAll(async () => {
    process.env.UPLOAD_DIR = testUploadDir;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);

    adminToken = jwtService.sign({ sub: 1, role: Role.ADMIN });
    userToken = jwtService.sign({ sub: 2, role: Role.USER });
  });

  afterAll(async () => {
    await app.close();
    if (fs.existsSync(fullTestUploadDir)) {
      fs.rmSync(fullTestUploadDir, { recursive: true, force: true });
    }
  });

  it('1. کاربر مهمان (بدون توکن) باید خطای 401 Unauthorized دریافت کند', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .field('type', 'product')
      .attach('file', pngBuffer, 'test.png');

    expect(res.status).toBe(401);
  });

  it('2. کاربر غیرادمین (Role.USER) باید خطای 403 Forbidden دریافت کند', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${userToken}`])
      .field('type', 'product')
      .attach('file', pngBuffer, 'test.png');

    expect(res.status).toBe(403);
  });

  it('3. ادمین با ارسال تصویر معتبر PNG باید پاسخ 201 و مسیر ذخیره‌شده دریافت کند', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'product')
      .attach('file', pngBuffer, 'original-name-ignored.png');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('path');
    expect(res.body.path).toMatch(/^products\/[0-9a-f-]{36}\.png$/);

    const savedFilePath = path.join(fullTestUploadDir, res.body.path);
    expect(fs.existsSync(savedFilePath)).toBe(true);
  });

  it('4. ادمین با ارسال تصویر معتبر JPEG برای دسته‌بندی باید پاسخ 201 دریافت کند', async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'category')
      .attach('file', jpegBuffer, 'banner.jpg');

    expect(res.status).toBe(201);
    expect(res.body.path).toMatch(/^categories\/[0-9a-f-]{36}\.jpg$/);
  });

  it('5. ادمین با ارسال تصویر معتبر WebP برای برند باید پاسخ 201 دریافت کند', async () => {
    const webpBuffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
      Buffer.from('VP8 '),
    ]);

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'brand')
      .attach('file', webpBuffer, 'logo.webp');

    expect(res.status).toBe(201);
    expect(res.body.path).toMatch(/^brands\/[0-9a-f-]{36}\.webp$/);
  });

  it('6. ارسال فایل متنی یا دستکاری‌شده با پسوند جعلی (.png) باید خطای 400 برگرداند', async () => {
    const fakeFileBuffer = Buffer.from('hello this is plain text pretend to be image');

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'product')
      .attach('file', fakeFileBuffer, 'hacked.png');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/فرمت فایل نامعتبر است/);
  });

  it('7. ارسال فایل SVG جهت جلوگیری از حملات XSS باید خطای 400 برگرداند', async () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'product')
      .attach('file', svgBuffer, 'vector.svg');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/فرمت فایل نامعتبر است/);
  });

  it('8. ارسال نوع مقصد نامعتبر یا تلاش برای Path Traversal باید خطای 400 برگرداند', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', '../../etc')
      .attach('file', pngBuffer, 'attack.png');

    expect(res.status).toBe(400);
  });

  it('9. عدم ارسال فایل در درخواست باید خطای 400 برگرداند', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'product');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/فایل آپلود ارسال نشده است/);
  });

  it('10. آپلود فایلی با حجم بیش از ۵ مگابایت باید خطای 413 Payload Too Large برگرداند', async () => {
    // ایجاد بافر با حجمی بزرگتر از ۵ مگابایت (5MB + 1KB)
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0);
    // بایت‌های جادویی PNG در ابتدای آن
    largeBuffer[0] = 0x89;
    largeBuffer[1] = 0x50;
    largeBuffer[2] = 0x4e;
    largeBuffer[3] = 0x47;
    largeBuffer[4] = 0x0d;
    largeBuffer[5] = 0x0a;
    largeBuffer[6] = 0x1a;
    largeBuffer[7] = 0x0a;

    const res = await request(app.getHttpServer())
      .post('/admin/uploads')
      .set('Cookie', [`accessToken=${adminToken}`])
      .field('type', 'product')
      .attach('file', largeBuffer, 'huge.png');

    expect(res.status).toBe(413);
  });
});
