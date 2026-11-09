import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ContactService } from './contact.service.js';
import { ContactSubject } from '../generated/prisma/client.js';

describe('ContactService (Phase 2)', () => {
  let service: ContactService;
  let prisma: any;
  let configService: any;

  beforeEach(() => {
    prisma = {
      contactMessage: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };

    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'CONTACT_IP_SECRET') return 'test-ip-secret-key';
        return undefined;
      }),
    };

    service = new ContactService(prisma, configService);
  });

  it('1. ثبت موفقیت‌آمیز پیام و بازگرداندن { message: "Received" }', async () => {
    const dto = {
      fullName: 'علی محمدی',
      phone: '09123456789',
      subject: ContactSubject.ORDER_ISSUE,
      message: 'پیام تست برای پیگیری سفارش ثبت‌شده',
    };

    const res = await service.createMessage(dto, '192.168.1.50', 10);

    expect(res).toEqual({ message: 'Received' });
    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: 'علی محمدی',
        phone: '09123456789',
        subject: ContactSubject.ORDER_ISSUE,
        message: 'پیام تست برای پیگیری سفارش ثبت‌شده',
        userId: 10,
        ipHash: expect.any(String),
      }),
    });

    // مطمئن می‌شویم IP خام هرگز در دیتابیس ثبت نمی‌شود
    const createdData = prisma.contactMessage.create.mock.calls[0][0].data;
    expect(createdData.ipHash).not.toBe('192.168.1.50');
    expect(createdData.ipHash).toHaveLength(64); // sha256 hex length
  });

  it('2. ربات‌ها و فیلد Honeypot: در صورت پر بودن website بدون ذخیره در دیتابیس پیام موفق بازگردانده می‌شود', async () => {
    const dto = {
      fullName: 'Bot User',
      phone: '09123456789',
      subject: ContactSubject.OTHER,
      message: 'Buy cheap watches http://spam.com',
      website: 'http://spam-bot.site',
    };

    const res = await service.createMessage(dto, '192.168.1.99', null);

    expect(res).toEqual({ message: 'Received' });
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    expect(prisma.contactMessage.count).not.toHaveBeenCalled();
  });

  it('3. کاربر ناشناس (userId=null) بدون خطا ثبت می‌شود', async () => {
    const dto = {
      fullName: 'مهمان ناشناس',
      phone: '09351112233',
      subject: ContactSubject.PRODUCT_QUESTION,
      message: 'آیا این کالا گارانتی ۲۴ ماهه دارد؟',
    };

    const res = await service.createMessage(dto, '127.0.0.1', null);

    expect(res).toEqual({ message: 'Received' });
    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
      }),
    });
  });

  it('4. محدودیت نرخ (Rate Limit): پیام چهارم از یک IP در ساعت خطای 429 می‌دهد', async () => {
    // شبیه‌سازی ۳ پیام ثبت‌شده در یک ساعت گذشته برای این IP
    prisma.contactMessage.count.mockResolvedValue(3);

    const dto = {
      fullName: 'کاربر پرتکرار',
      phone: '09123456789',
      subject: ContactSubject.DELIVERY_ISSUE,
      message: 'بسته پستی من هنوز نرسیده است لطفاً پیگیری کنید',
    };

    await expect(
      service.createMessage(dto, '192.168.1.1', null),
    ).rejects.toThrow(HttpException);

    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('5. محدودیت نرخ (Rate Limit): پیام چهارم با یک شماره تلفن در ساعت خطای 429 می‌دهد', async () => {
    // اولی برای IP (مجاز: 0)، دومی برای شماره تلفن (3 عدد)
    prisma.contactMessage.count
      .mockResolvedValueOnce(0) // ipHourly
      .mockResolvedValueOnce(3); // phoneHourly

    const dto = {
      fullName: 'کاربر شماره ثابت',
      phone: '09129998877',
      subject: ContactSubject.PAYMENT_ISSUE,
      message: 'مشکل در پرداخت کارت به کارت دارم لطفا بررسی فرمایید',
    };

    await expect(
      service.createMessage(dto, '10.0.0.1', null),
    ).rejects.toThrow(HttpException);

    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('6. محدودیت نرخ (Rate Limit): پیام یازدهم از یک IP در روز خطای 429 می‌دهد', async () => {
    prisma.contactMessage.count
      .mockResolvedValueOnce(0) // ipHourly
      .mockResolvedValueOnce(0) // phoneHourly
      .mockResolvedValueOnce(10); // ipDaily

    const dto = {
      fullName: 'کاربر روزانه',
      phone: '09121112233',
      subject: ContactSubject.OTHER,
      message: 'متن پیام تستی برای سقف روزانه پیام‌های تماس با ما',
    };

    await expect(
      service.createMessage(dto, '10.0.0.1', null),
    ).rejects.toThrow(HttpException);

    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });
});
