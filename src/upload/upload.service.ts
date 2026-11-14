import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ImageTypeInfo,
  UPLOAD_TYPE_MAP,
  UploadType,
} from './upload.constants.js';

export interface UploadedFileInput {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type UploadedFile = UploadedFileInput;

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly baseUploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const dirName =
      this.configService.get<string>('UPLOAD_DIR') ||
      process.env.UPLOAD_DIR ||
      'public-uploads';
    this.baseUploadDir = path.resolve(process.cwd(), dirName);
  }

  async onModuleInit() {
    await fs.promises.mkdir(this.baseUploadDir, { recursive: true });
    for (const folder of Object.values(UPLOAD_TYPE_MAP)) {
      await fs.promises.mkdir(path.join(this.baseUploadDir, folder), {
        recursive: true,
      });
    }
  }

  /**
   * بررسی بایت‌های جادویی (Magic Bytes) برای تشخیص نوع واقعی محتوای فایل
   * جهت جلوگیری از اتک‌های تغییر پسوند یا ارسال اسکریپت/HTML با پسوند عکس
   */
  detectMagicBytes(buffer: Buffer): ImageTypeInfo | null {
    if (!buffer || buffer.length < 3) {
      return null;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { ext: '.jpg', mime: 'image/jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { ext: '.png', mime: 'image/png' };
    }

    // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { ext: '.webp', mime: 'image/webp' };
    }

    return null;
  }

  /**
   * ذخیره امن فایل روی دیسک پس از تایید بایت‌های جادویی و نوع مقصد
   */
  async saveFile(
    file?: UploadedFile,
    type?: string,
  ): Promise<{ path: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('فایل آپلود ارسال نشده است');
    }

    if (!type || !(type in UPLOAD_TYPE_MAP)) {
      throw new BadRequestException(
        'نوع فایل ارسالی نامعتبر است. مقادیر مجاز: product, category, brand',
      );
    }

    const detected = this.detectMagicBytes(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        'فرمت فایل نامعتبر است. فقط فرمت‌های JPEG، PNG و WebP مجاز می‌باشند',
      );
    }

    const folder = UPLOAD_TYPE_MAP[type as UploadType];
    const filename = `${randomUUID()}${detected.ext}`;
    const destinationPath = path.join(this.baseUploadDir, folder, filename);

    await fs.promises.writeFile(destinationPath, file.buffer);

    return {
      path: `${folder}/${filename}`,
    };
  }

  getBaseUploadDir(): string {
    return this.baseUploadDir;
  }
}
