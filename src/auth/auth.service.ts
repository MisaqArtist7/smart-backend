import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from '../sms/sms.service.js';
import { LoginDto, RegisterDto, VerifyOtpDto } from './dto/auth.dto.js';
import { REFRESH_TOKEN_MAX_AGE_MS } from './auth.constants.js';

const OTP_TTL_MS = 2 * 60_000; // کد ۲ دقیقه اعتبار دارد
const RESEND_DELAY_MS = 60_000; // فاصله‌ی بین دو درخواست (۱ دقیقه)
const MAX_REQUESTS_PER_HOUR = 5; // حداکثر ۵ درخواست در ساعت
const MAX_FAILED_ATTEMPTS = 5; // حداکثر تلاش اشتباه قبل از باطل شدن کد

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly jwtService: JwtService,
  ) {}

  private hashCode(code: string): string {
    const secret = process.env.OTP_SECRET || 'smart-electric-otp-secret-key';
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  /**
   * تولید توکن دسترسی (Access Token) با مدت زمان ۱۵ دقیقه
   */
  async generateAccessToken(user: {
    id: number;
    phone: string;
    role: string;
  }): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });
  }

  /**
   * تولید رشته تصادفی امن برای رفرش توکن
   */
  generateRefreshToken(): string {
    return randomBytes(40).toString('hex');
  }

  /**
   * هش کردن رفرش توکن با SHA-256 جهت ذخیره در دیتابیس
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * ایجاد نشست جدید و ثبت رفرش توکن در دیتابیس
   */
  async issueSession(
    userId: number,
    userPhone: string,
    userRole: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.generateAccessToken({
      id: userId,
      phone: userPhone,
      role: userRole,
    });

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /**
   * تولید و ارسال کد OTP به همراه بررسی محدودیت‌های زمانی و تعداد درخواست
   */
  private async sendOtp(phone: string): Promise<string> {
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

    return code;
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

    const code = await this.sendOtp(dto.phone);

    return {
      message: 'ثبت‌نام با موفقیت انجام شد و کد تأیید ارسال گردید',
      phone: user.phone,
      isNewUser: true,
      ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
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

    const code = await this.sendOtp(dto.phone);

    return {
      message: 'کد تأیید با موفقیت ارسال شد',
      phone: user.phone,
      isNewUser: false,
      ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
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

    const code = await this.sendOtp(phone);

    return {
      message: 'کد تأیید ارسال شد',
      phone,
      isNewUser: !user,
      ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
    };
  }

  /**
   * سناریوی تأیید کد OTP و ورود:
   * بررسی صحت کد، تاریخ انقضا و تعداد دفعات اشتباه؛
   * در صورت صحت، کد باطل شده، نشست و توکن‌های ورود تولید می‌گردند.
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

    // صدور توکن‌ها و ایجاد نشست
    const tokens = await this.issueSession(user.id, user.phone, user.role);

    return {
      message: 'ورود با موفقیت انجام شد',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * سناریوی تمدید توکن (Refresh Token Rotation):
   * ۱. خواندن هش رفرش توکن از دیتابیس
   * ۲. تشخیص استفاده مجدد (Re-use detection / دزدی توکن): اگر توکن قبلاً باطل شده بود، کلیه نشست‌های کاربر باطل می‌شوند.
   * ۳. بررسی وضعیت کاربر و تاریخ انقضا
   * ۴. باطل کردن توکن فعلی و ایجاد توکن جدید در یک Transaction
   * ۵. تولید Access Token جدید
   */
  async refresh(rawRefreshToken?: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('رفرش توکن یافت نشد');
    }

    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // ۱. رفرش توکن در دیتابیس یافت نشد
    if (!tokenRecord) {
      throw new UnauthorizedException('رفرش توکن نامعتبر است');
    }

    // ۲. تشخیص دزدی (Reuse Detection): اگر توکنی که قبلاً باطل شده استفاده شود،
    // احتمالاً به سرقت رفته است؛ بنابراین کلیه رفرش توکن‌های آن کاربر فوراً باطل می‌شوند.
    if (tokenRecord.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'نشست نامعتبر شناسایی شد؛ به دلیل امنیتی کلیه نشست‌های فعال باطل شدند. لطفاً دوباره وارد شوید',
      );
    }

    // ۳. بررسی فعال بودن حساب کاربر
    if (!tokenRecord.user.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('حساب کاربری شما غیرفعال شده است');
    }

    // ۴. بررسی تاریخ انقضای رفرش توکن
    if (new Date() > tokenRecord.expiresAt) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('رفرش توکن منقضی شده است');
    }

    // ۵. چرخش توکن (Rotation): باطل کردن توکن قبلی و ساخت توکن جدید در یک Transaction
    const newRawRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: tokenRecord.userId,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    const newAccessToken = await this.generateAccessToken({
      id: tokenRecord.user.id,
      phone: tokenRecord.user.phone,
      role: tokenRecord.user.role,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * سناریوی خروج (Logout):
   * رفرش توکن فعلی دستگاه باطل می‌شود. در صورت نبود یا باطل بودن قبلی، باز هم موفق برمی‌گرداند (Idempotent).
   */
  async logout(rawRefreshToken?: string): Promise<{ message: string }> {
    if (rawRefreshToken) {
      const tokenHash = this.hashRefreshToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'با موفقیت خارج شدید' };
  }

  /**
   * سناریوی دریافت اطلاعات کاربر وارد شده (Me)
   */
  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return user;
  }
}
