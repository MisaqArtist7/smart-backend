import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { UploadService, type UploadedFile } from './upload.service.js';

describe('UploadService (Magic Bytes & File Storage)', () => {
  let service: UploadService;
  let configService: any;
  const testUploadDir = path.resolve(process.cwd(), 'test-uploads-spec');

  beforeEach(async () => {
    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'UPLOAD_DIR') return 'test-uploads-spec';
        return undefined;
      }),
    };

    service = new UploadService(configService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testUploadDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('detectMagicBytes', () => {
    it('1. تشخیص معتبر فایل PNG از روی بایت‌های جادویی', () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const res = service.detectMagicBytes(pngBuffer);
      expect(res).toEqual({ ext: '.png', mime: 'image/png' });
    });

    it('2. تشخیص معتبر فایل JPEG از روی بایت‌های جادویی', () => {
      const jpgBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      const res = service.detectMagicBytes(jpgBuffer);
      expect(res).toEqual({ ext: '.jpg', mime: 'image/jpeg' });
    });

    it('3. تشخیص معتبر فایل WebP از روی بایت‌های جادویی', () => {
      // RIFF .... WEBP
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const res = service.detectMagicBytes(webpBuffer);
      expect(res).toEqual({ ext: '.webp', mime: 'image/webp' });
    });

    it('4. رد فایل SVG جهت جلوگیری از حملات XSS (عدم پذیرش SVG)', () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const res = service.detectMagicBytes(svgBuffer);
      expect(res).toBeNull();
    });

    it('5. رد فایل متنی ساده که با پسوند جعلی a.png ارسال شده است', () => {
      const fakeTextBuffer = Buffer.from('This is just a plain text pretending to be png');
      const res = service.detectMagicBytes(fakeTextBuffer);
      expect(res).toBeNull();
    });
  });

  describe('saveFile', () => {
    it('6. پرتاب خطای 400 در صورت عدم ارسال فایل', async () => {
      await expect(service.saveFile(undefined as any, 'product')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('7. پرتاب خطای 400 در صورت ارسال نوع مقصد نامعتبر یا تلاش برای Path Traversal', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const file: UploadedFile = {
        fieldname: 'file',
        originalname: 'lamp.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      await expect(service.saveFile(file, '../evil')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.saveFile(file, 'invalid_type')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('8. پرتاب خطای 400 در صورت عدم تطابق بایت‌های جادویی', async () => {
      const textBuffer = Buffer.from('not an image');
      const file: UploadedFile = {
        fieldname: 'file',
        originalname: 'fake.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: textBuffer.length,
        buffer: textBuffer,
      };

      await expect(service.saveFile(file, 'product')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('9. ذخیره موفق تصویر معتبر و دور ریختن نام اصلی فایل و جایگزینی با UUID', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const file: UploadedFile = {
        fieldname: 'file',
        originalname: 'خرید لامپ %20 ../../shell.php.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      const result = await service.saveFile(file, 'product');

      expect(result).toHaveProperty('path');
      expect(result.path.startsWith('products/')).toBe(true);
      expect(result.path.endsWith('.png')).toBe(true);
      expect(result.path).not.toContain('lamp');
      expect(result.path).not.toContain('shell');

      // بررسی فیزیکی وجود فایل در دیسک
      const fullDiskPath = path.join(testUploadDir, result.path);
      const exists = fs.existsSync(fullDiskPath);
      expect(exists).toBe(true);
    });

    it('10. دو آپلود با یک نام فایل مشخص، دو مسیر با UUID کاملاً متفاوت و مجزا ایجاد می‌کنند', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const file1: UploadedFile = {
        fieldname: 'file',
        originalname: 'lamp.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };
      const file2: UploadedFile = {
        fieldname: 'file',
        originalname: 'lamp.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      const res1 = await service.saveFile(file1, 'product');
      const res2 = await service.saveFile(file2, 'product');

      expect(res1.path).not.toEqual(res2.path);
    });
  });
});

