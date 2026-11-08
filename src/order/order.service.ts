import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptStorageService } from './receipt-storage.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { GetMyOrdersDto } from './dto/get-my-orders.dto.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/client.js';
import { generateOrderNumber } from './order.utils.js';

export const customerOrderSelect = {
  id: true,
  userId: true,
  orderNumber: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  receiptUrl: true,
  itemsPrice: true,
  shippingPrice: true,
  totalPrice: true,
  receiverName: true,
  receiverPhone: true,
  province: true,
  city: true,
  addressLine: true,
  postalCode: true,
  note: true,
  trackingCode: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      title: true,
      price: true,
      quantity: true,
    },
  },
} as const;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReceiptStorageService,
  ) {}

  /**
   * ثبت سفارش جدید توسط خریدار
   * - بررسی عدم تکراری بودن اقلام
   * - بررسی آدرس خریدار
   * - بررسی ضد سوءاستفاده (حداکثر ۳ سفارش در وضعیت انتظار پرداخت)
   * - بررسی فعال بودن کالاها و دسته‌بندی آن‌ها
   * - محاسبه قیمت اسنپ‌شات (تومان)
   * - کسر شرطی موجودی و ثبت سفارش به صورت اتمیک در ترنزکشن
   * - حذف adminNote از خروجی خریدار
   */
  async createOrder(userId: number, dto: CreateOrderDto) {
    // ۱. بررسی اقلام تکراری در درخواست
    const productIds = dto.items.map((i) => i.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException('اقلام سفارش شامل کالای تکراری است');
    }

    // ۲. بررسی آدرس متعلق به همین کاربر
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('آدرس مورد نظر یافت نشد');
    }

    // ۳. بررسی سقف سفارش‌های پرداخت‌نشده (حداکثر ۳ سفارش در انتظار پرداخت یا ناموفق)
    const pendingOrdersCount = await this.prisma.order.count({
      where: {
        userId,
        status: OrderStatus.PENDING,
        paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
      },
    });
    if (pendingOrdersCount >= 3) {
      throw new ConflictException(
        'شما ۳ سفارش در انتظار پرداخت دارید. لطفاً ابتدا آن‌ها را تکمیل یا لغو کنید',
      );
    }

    // ۴. بررسی کالاها و فعال بودن آن‌ها و دسته‌بندی آن‌ها
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new BadRequestException(
          `کالایی با شناسه ${item.productId} یافت نشد`,
        );
      }
      if (!prod.isActive) {
        throw new BadRequestException(
          `کالای "${prod.title}" در حال حاضر غیرفعال است`,
        );
      }
      if (!prod.category.isActive) {
        throw new BadRequestException(
          `دسته‌بندی کالای "${prod.title}" در حال حاضر غیرفعال است`,
        );
      }
    }

    // ۵. محاسبه قیمت اسنپ‌شات کالاها (هزینه ارسال به مامور پست پرداخت می‌شود و 0 است)
    let itemsPrice = 0;
    const orderItemsData = dto.items.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice = prod.discountPrice ?? prod.price;
      itemsPrice += unitPrice * item.quantity;
      return {
        productId: prod.id,
        title: prod.title,
        price: unitPrice,
        quantity: item.quantity,
      };
    });

    const shippingPrice = 0;
    const totalPrice = itemsPrice;

    // مرتب‌سازی بر اساس شناسه محصول جهت جلوگیری قطعی از Deadlock در سفارش‌های همزمان
    const sortedItems = [...dto.items].sort((a, b) => a.productId - b.productId);

    // ۶. اجرای ترنزکشن اتمیک رزرو موجودی و ثبت سفارش
    const order = await this.prisma.$transaction(async (tx) => {
      // کسر شرطی موجودی کالاها
      for (const item of sortedItems) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updateResult.count === 0) {
          const prod = productMap.get(item.productId)!;
          throw new ConflictException(`موجودی کالای "${prod.title}" کافی نیست`);
        }
      }

      // تولید شماره سفارش یکتا با تلاش مجدد در صورت تصادف نامحتمل
      let orderNumber = generateOrderNumber();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await tx.order.findUnique({
          where: { orderNumber },
          select: { id: true },
        });
        if (!existing) break;
        orderNumber = generateOrderNumber();
      }

      // ثبت سفارش و اقلام آن با ذخیره اسنپ‌شات کامل آدرس و قیمت‌ها
      return tx.order.create({
        data: {
          userId,
          orderNumber,
          status: OrderStatus.PENDING,
          paymentMethod: PaymentMethod.CARD_TO_CARD,
          paymentStatus: PaymentStatus.PENDING,
          itemsPrice,
          shippingPrice,
          totalPrice,
          receiverName: address.receiverName,
          receiverPhone: address.receiverPhone,
          province: address.province,
          city: address.city,
          addressLine: address.addressLine,
          postalCode: address.postalCode,
          note: dto.note?.trim() || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });
    });

    // حذف یادداشت داخلی ادمین (adminNote) از پاسخی که به خریدار برگردانده می‌شود
    const { adminNote: _, ...customerSafeOrder } = order;
    return customerSafeOrder;
  }

  /**
   * لیست سفارش‌های خریدار جاری به صورت صفحه‌بندی‌شده
   * - مرتب‌سازی از جدیدترین به قدیمی‌ترین
   * - بدون فیلد adminNote
   */
  async getMyOrders(userId: number, query: GetMyOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        select: customerOrderSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({
        where: { userId },
      }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || (total === 0 ? 0 : 1),
      },
    };
  }

  /**
   * دریافت جزئیات یک سفارش توسط خریدار
   * - فقط مالک سفارش؛ سفارش متعلق به دیگری یا ناموجود خطای 404 می‌دهد (نه 403)
   * - بدون فیلد adminNote
   */
  async getMyOrderById(id: number, userId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      select: customerOrderSelect,
    });

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    return order;
  }

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
