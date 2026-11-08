import { describe, it, expect, vi } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';
import { PaymentInfoController } from './payment-info.controller.js';

describe('PaymentInfoController (Phase 2)', () => {
  it('1. بازگرداندن اطلاعات کارت در صورت وجود کلیدهای env', () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'SHOP_CARD_NUMBER') return '6037997123456789';
        if (key === 'SHOP_CARD_HOLDER') return 'فروشگاه تست';
        if (key === 'SHOP_BANK_NAME') return 'بانک ملی';
        return undefined;
      }),
    };

    const controller = new PaymentInfoController(mockConfig as any);
    const result = controller.getPaymentInfo();

    expect(result).toEqual({
      cardNumber: '6037997123456789',
      cardHolder: 'فروشگاه تست',
      bankName: 'بانک ملی',
    });
  });

  it('2. پرتاب خطای 500 در صورت نبود شماره کارت یا نام دارنده کارت', () => {
    const mockConfig = {
      get: vi.fn(() => undefined),
    };
    // موقتا env را پاک می‌کنیم
    const origCard = process.env.SHOP_CARD_NUMBER;
    const origHolder = process.env.SHOP_CARD_HOLDER;
    delete process.env.SHOP_CARD_NUMBER;
    delete process.env.SHOP_CARD_HOLDER;

    const controller = new PaymentInfoController(mockConfig as any);
    expect(() => controller.getPaymentInfo()).toThrow(
      InternalServerErrorException,
    );

    // بازگرداندن env
    process.env.SHOP_CARD_NUMBER = origCard;
    process.env.SHOP_CARD_HOLDER = origHolder;
  });
});

