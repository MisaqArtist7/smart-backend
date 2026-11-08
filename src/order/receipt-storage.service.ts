import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadedReceiptFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const MIME_TO_EXT: Record<SupportedImageMime, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class ReceiptStorageService implements OnModuleInit {
  private readonly baseStorageDir = path.resolve(process.cwd(), 'storage');
  private readonly receiptsDir = path.join(this.baseStorageDir, 'receipts');

  async onModuleInit() {
    await fs.promises.mkdir(this.receiptsDir, { recursive: true });
  }

  /**
   * بررسی امضای واقعی فایل (Magic Bytes)
   */
  detectMagicBytes(buffer: Buffer): SupportedImageMime | null {
    if (!buffer || buffer.length < 12) {
      return null;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return 'image/webp';
    }

    return null;
  }

  /**
   * ذخیره تصویر فیش واریزی با نام تصادفی سرور
   */
  async saveReceipt(file?: UploadedReceiptFile): Promise<{
    relativePath: string;
    mimeType: SupportedImageMime;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('فایل فیش واریزی ارسال نشده است');
    }

    if (
      file.size > MAX_FILE_SIZE_BYTES ||
      file.buffer.length > MAX_FILE_SIZE_BYTES
    ) {
      throw new BadRequestException(
        'حجم فایل بیش از حد مجاز است (حداکثر ۵ مگابایت)',
      );
    }

    const detectedMime = this.detectMagicBytes(file.buffer);
    if (!detectedMime) {
      throw new BadRequestException(
        'فرمت فایل نامعتبر است. فقط تصاویر JPEG، PNG و WebP مجاز می‌باشند',
      );
    }

    const ext = MIME_TO_EXT[detectedMime];
    const filename = `${randomUUID()}${ext}`;
    const targetPath = path.join(this.receiptsDir, filename);

    await fs.promises.writeFile(targetPath, file.buffer);

    return {
      relativePath: path.join('receipts', filename),
      mimeType: detectedMime,
    };
  }

  /**
   * حذف ایمن فیش قبلی
   */
  async deleteFile(relativePath?: string | null): Promise<void> {
    if (!relativePath) return;
    try {
      const fullPath = this.resolveFullPath(relativePath);
      await fs.promises.unlink(fullPath);
    } catch {
      // نادیده گرفتن در صورت عدم وجود یا خطای حذف
    }
  }

  /**
   * تبدیل مسیر نسبی به مسیر مطلق و جلوگیری از Path Traversal
   */
  resolveFullPath(relativePath: string): string {
    const cleanRelative = path
      .normalize(relativePath)
      .replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.baseStorageDir, cleanRelative);
  }

  /**
   * خواندن فایل فیش برای سرو کردن امن
   */
  async getReceiptStream(relativePath: string): Promise<{
    stream: fs.ReadStream;
    mimeType: SupportedImageMime;
  }> {
    const fullPath = this.resolveFullPath(relativePath);
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
    } catch {
      throw new NotFoundException('فایل فیش واریزی در سرور یافت نشد');
    }

    // خواندن ۱۲ بایت ابتدایی برای تشخیص MIME
    const fd = await fs.promises.open(fullPath, 'r');
    const headerBuffer = Buffer.alloc(12);
    await fd.read(headerBuffer, 0, 12, 0);
    await fd.close();

    const detectedMime = this.detectMagicBytes(headerBuffer) || 'image/jpeg';

    return {
      stream: fs.createReadStream(fullPath),
      mimeType: detectedMime,
    };
  }
}

