import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('payment-info')
export class PaymentInfoController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getPaymentInfo() {
    const cardNumber =
      this.config.get<string>('SHOP_CARD_NUMBER') ||
      process.env.SHOP_CARD_NUMBER;
    const cardHolder =
      this.config.get<string>('SHOP_CARD_HOLDER') ||
      process.env.SHOP_CARD_HOLDER;
    const bankName =
      this.config.get<string>('SHOP_BANK_NAME') || process.env.SHOP_BANK_NAME;

    if (!cardNumber || !cardHolder) {
      throw new InternalServerErrorException(
        'اطلاعات کارت بانکی فروشگاه در تنظیمات سرور پیکربندی نشده است (کلیدهای SHOP_CARD_NUMBER یا SHOP_CARD_HOLDER)',
      );
    }

    return {
      cardNumber,
      cardHolder,
      ...(bankName ? { bankName } : {}),
    };
  }
}
