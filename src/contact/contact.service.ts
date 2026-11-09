import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContactDto } from './dto/create-contact.dto.js';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hashes the raw IP address with HMAC-SHA256 to protect visitor privacy.
   * Never stores or logs raw IP addresses.
   */
  hashIp(rawIp: string): string {
    const secret =
      this.configService.get<string>('CONTACT_IP_SECRET') ||
      process.env.CONTACT_IP_SECRET ||
      'default-contact-ip-secret-key-change-in-prod';
    return createHmac('sha256', secret).update(rawIp || 'unknown').digest('hex');
  }

  async createMessage(
    dto: CreateContactDto,
    rawIp: string,
    userId: number | null,
  ): Promise<{ message: string }> {
    // 1. Honeypot check: If the hidden 'website' field is filled by a bot,
    // return success silently without persisting anything in the database.
    if (dto.website && dto.website.trim().length > 0) {
      return { message: 'Received' };
    }

    const ipHash = this.hashIp(rawIp);
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // 2. Abuse limits enforced via fast indexed DB counts:
    // a. Max 3 messages per hour per ipHash
    const ipHourlyCount = await this.prisma.contactMessage.count({
      where: {
        ipHash,
        createdAt: { gte: oneHourAgo },
      },
    });
    if (ipHourlyCount >= 3) {
      throw new HttpException(
        'Too many requests from this IP. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // b. Max 3 messages per hour per phone
    const phoneHourlyCount = await this.prisma.contactMessage.count({
      where: {
        phone: dto.phone,
        createdAt: { gte: oneHourAgo },
      },
    });
    if (phoneHourlyCount >= 3) {
      throw new HttpException(
        'Too many requests for this phone number. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // c. Max 10 messages per day per ipHash
    const ipDailyCount = await this.prisma.contactMessage.count({
      where: {
        ipHash,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (ipDailyCount >= 10) {
      throw new HttpException(
        'Daily limit reached from this IP. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. Save message row
    await this.prisma.contactMessage.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        subject: dto.subject,
        message: dto.message,
        userId: userId ?? null,
        ipHash,
      },
    });

    return { message: 'Received' };
  }
}

