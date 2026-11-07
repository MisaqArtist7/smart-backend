import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from '../sms/sms.service.js';
import { LoginDto, RegisterDto, VerifyOtpDto } from './dto/auth.dto.js';

const OTP_TTL_MS = 2 * 60_000; // کد ۲ دقیقه اعتبار دارد
const RESEND_DELAY_MS = 60_000; // فاصله‌ی بین دو درخواست (۱ دقیقه)
const MAX_REQUESTS_PER_HOUR = 5; // حداکثر ۵ درخواست در ساعت
const MAX_FAILED_ATTEMPTS = 5; // حداکثر تلاش اشتباه قبل از باطل شدن کد

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  private hashCode(code: string): string {
    const secret = process.env.OTP_SECRET || 'smart-electric-otp-secret-key';
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  /**
   * تولید و ارسال کد OTP به همراه بررسی محدودیت‌های زمانی و تعداد درخواست
   */
  private async sendOtp(phone: string): Promise<void> {
    const now = Date.now();

    // بررسی حداقل فاصله‌ی زمانی بین دو درخواست ارسال پیامک
    const lastOtp = await this.prisma.otp.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOtp && now - lastOtp.createdAt.getTime() < RESEND_DELAY_MS) {
      throw new HttpException(
        'لطفاً قبل از ارسال مجدد کد کمی صبر کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // بررسی محدودیت تعداد درخواست در یک ساعت گذشته
    const lastHourCount = await this.prisma.otp.count({
      where: { phone, createdAt: { gte: new Date(now - 60 * 60_000) } },
    });

    if (lastHourCount >= MAX_REQUESTS_PER_HOUR) {
      throw new HttpException(
        'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً یک ساعت دیگر تلاش کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // تولید کد تصادفی ۶ رقمی
    const code = randomInt(100000, 1000000).toString();

    // ذخیره‌ی هش کد در دیتابیس
    await this.prisma.otp.create({
      data: {
        phone,
        codeHash: this.hashCode(code),
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    });

    // ارسال کد از طریق سرویس اس‌ام‌اس
    await this.sms.sendOtp(phone, code);
  }

  /**
   * سناریوی ثبت‌نام:
   * دریافت نام و شماره تلفن؛ اگر کاربر وجود داشت خطا می‌دهد که وارد شود.
   * اگر وجود نداشت کاربر را ایجاد کرده و سپس کد OTP را ارسال می‌کند.
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existingUser) {
      throw new ConflictException(
        'کاربری با این شماره تلفن قبلاً ثبت‌نام کرده است. لطفاً وارد شوید',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
      },
    });

    await this.sendOtp(dto.phone);

    return {
      message: 'ثبت‌نام با موفقیت انجام شد و کد تأیید ارسال گردید',
      phone: user.phone,
      isNewUser: true,
    };
  }

  /**
   * سناریوی ورود:
   * بررسی وجود کاربر؛ اگر وجود نداشت خطا می‌دهد که ثبت‌نام کند.
   * اگر وجود داشت کد OTP ارسال می‌شود.
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new NotFoundException(
        'کاربری با این شماره تلفن یافت نشد. لطفاً ابتدا ثبت‌نام کنید',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('حساب کاربری شما غیرفعال شده است');
    }

    await this.sendOtp(dto.phone);

    return {
      message: 'کد تأیید با موفقیت ارسال شد',
      phone: user.phone,
      isNewUser: false,
    };
  }

  /**
   * درخواست مجدد کد OTP
   */
  async requestOtp(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user && !user.isActive) {
      throw new ForbiddenException('حساب کاربری شما غیرفعال شده است');
    }

    await this.sendOtp(phone);

    return {
      message: 'کد تأیید ارسال شد',
      phone,
      isNewUser: !user,
    };
  }

  /**
   * سناریوی تأیید کد OTP:
   * بررسی صحت کد، تاریخ انقضا و تعداد دفعات اشتباه؛ در صورت صحت، کاربر لاگین می‌شود.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new NotFoundException('کاربری با این شماره تلفن یافت نشد');
    }

    if (!user.isActive) {
      throw new ForbiddenException('حساب کاربری شما غیرفعال شده است');
    }

    const latestOtp = await this.prisma.otp.findFirst({
      where: { phone: dto.phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestOtp) {
      throw new BadRequestException('هیچ کد تأییدی برای این شماره یافت نشد');
    }

    if (latestOtp.usedAt) {
      throw new BadRequestException('این کد تأیید قبلاً استفاده شده است');
    }

    if (new Date() > latestOtp.expiresAt) {
      throw new BadRequestException(
        'کد تأیید منقضی شده است. لطفاً مجدداً درخواست دهید',
      );
    }

    if (latestOtp.attempts >= MAX_FAILED_ATTEMPTS) {
      throw new BadRequestException(
        'تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً مجدداً کد دریافت کنید',
      );
    }

    const hashedInput = this.hashCode(dto.code);

    if (hashedInput !== latestOtp.codeHash) {
      await this.prisma.otp.update({
        where: { id: latestOtp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('کد تأیید وارد شده اشتباه است');
    }

    // علامت‌گذاری کد به عنوان استفاده شده
    await this.prisma.otp.update({
      where: { id: latestOtp.id },
      data: { usedAt: new Date() },
    });

    return {
      message: 'ورود با موفقیت انجام شد',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }
}
