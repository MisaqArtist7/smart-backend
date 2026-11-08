import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  ReceiptStorageService,
  UploadedReceiptFile,
} from './receipt-storage.service.js';

describe('ReceiptStorageService (Phase 2)', () => {
  let service: ReceiptStorageService;

  beforeEach(async () => {
    service = new ReceiptStorageService();
    await service.onModuleInit();
  });

  afterEach(async () => {
    // پاک‌سازی فایل‌های آزمایشی ساخته‌شده
    const receiptsDir = path.resolve(process.cwd(), 'private-uploads', 'receipts');
    try {
      const files = await fs.promises.readdir(receiptsDir);
      for (const file of files) {
        if (file.endsWith('.test.tmp')) {
          await fs.promises.unlink(path.join(receiptsDir, file));
        }
      }
    } catch {
      // نادیده گرفتن
    }
  });

  it('1. تشخیص صحیح امضای فایل JPEG (FF D8 FF)', () => {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    expect(service.detectMagicBytes(jpegBuffer)).toBe('image/jpeg');
  });

  it('2. تشخیص صحیح امضای فایل PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(service.detectMagicBytes(pngBuffer)).toBe('image/png');
  });

  it('3. تشخیص صحیح امضای فایل WebP (RIFF...WEBP)', () => {
    // RIFF (4 bytes) + 4 bytes length + WEBP (4 bytes)
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(service.detectMagicBytes(webpBuffer)).toBe('image/webp');
  });

  it('4. رد کردن فایلی که پسوند عکس دارد اما بایت‌های واقعی آن عکس نیستند', async () => {
    const fakeBuffer = Buffer.from('FAKE-TEXT-DATA-NOT-AN-IMAGE');
    const fakeFile: UploadedReceiptFile = {
      fieldname: 'receipt',
      originalname: 'fake-receipt.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: fakeBuffer.length,
      buffer: fakeBuffer,
    };

    await expect(service.saveReceipt(fakeFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('5. رد کردن فایل با حجم بیش از ۵ مگابایت', async () => {
    const validHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 10);
    validHeader.copy(largeBuffer);

    const largeFile: UploadedReceiptFile = {
      fieldname: 'receipt',
      originalname: 'large.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: largeBuffer.length,
      buffer: largeBuffer,
    };

    await expect(service.saveReceipt(largeFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('6. ذخیره موفق با نام تصادفی تولیدشده توسط سرور (نادیده گرفتن نام اصلی)', async () => {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const file: UploadedReceiptFile = {
      fieldname: 'receipt',
      originalname: 'client-dangerous-name.exe.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: jpegBuffer.length,
      buffer: jpegBuffer,
    };

    const saved = await service.saveReceipt(file);

    expect(saved.relativePath).toMatch(/^receipts\/[a-f0-9-]+\.jpg$/);
    expect(saved.relativePath).not.toContain('client-dangerous-name');
    expect(saved.mimeType).toBe('image/jpeg');

    // بررسی وجود فیزیکی فایل روی دیسک
    const fullPath = service.resolveFullPath(saved.relativePath);
    expect(fs.existsSync(fullPath)).toBe(true);

    // تمیزکاری فایل آزمایشی
    await service.deleteFile(saved.relativePath);
    expect(fs.existsSync(fullPath)).toBe(false);
  });
});

