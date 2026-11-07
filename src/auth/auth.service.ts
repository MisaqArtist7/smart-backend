import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHmac, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from '../sms/sms.service.js';

const OTP_TTL_MS = 2 * 60_000;        // کد ۲ دقیقه اعتبار دارد
const RESEND_DELAY_MS = 60_000;       // فاصله‌ی بین دو درخواست
const MAX_REQUESTS_PER_HOUR = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  private hashCode(code: string) {
    return createHmac('sha256', process.env.OTP_SECRET!)
      .update(code)
      .digest('hex');
  }

  async requestOtp(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user && !user.isActive) {
      throw new ForbiddenException('This account is disabled');
    }

    const now = Date.now();

    const last = await this.prisma.otp.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (last && now - last.createdAt.getTime() < RESEND_DELAY_MS) {
      throw new HttpException(
        'Please wait before requesting a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const lastHourCount = await this.prisma.otp.count({
      where: { phone, createdAt: { gte: new Date(now - 60 * 60_000) } },
    });
    if (lastHourCount >= MAX_REQUESTS_PER_HOUR) {
      throw new HttpException(
        'Too many requests. Try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100000, 1000000).toString();

    await this.prisma.otp.create({
      data: {
        phone,
        codeHash: this.hashCode(code),
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    });

    await this.sms.sendOtp(phone, code);

    return { message: 'Code sent', isNewUser: !user };
  }
}