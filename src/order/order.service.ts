import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptStorageService } from './receipt-storage.service.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReceiptStorageService,
  ) {}

  /**
   * دریافت استریم فیش واریزی برای خریدار (فقط مالک سفارش)
   * اگر سفارش وجود نداشت یا متعلق به کاربر نبود، خطای 404 برمی‌گردد
   */
  async getReceiptStreamForUser(orderId: number, userId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, receiptUrl: true },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    if (!order.receiptUrl) {
      throw new NotFoundException(
        'تصویر فیش واریزی برای این سفارش ثبت نشده است',
      );
    }

    return this.storage.getReceiptStream(order.receiptUrl);
  }

  /**
   * دریافت استریم فیش واریزی برای پنل مدیریت
   */
  async getReceiptStreamForAdmin(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, receiptUrl: true },
    });

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    if (!order.receiptUrl) {
      throw new NotFoundException(
        'تصویر فیش واریزی برای این سفارش ثبت نشده است',
      );
    }

    return this.storage.getReceiptStream(order.receiptUrl);
  }
}

