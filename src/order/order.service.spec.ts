import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service.js';
import { generateOrderNumber, ORDER_NUMBER_ALPHABET } from './order.utils.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/client.js';

describe('OrderService - Phase 3 (Create Order)', () => {
  let service: OrderService;
  let prisma: any;
  let storage: any;

  beforeEach(() => {
    prisma = {
      address: {
        findFirst: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(prisma);
      }),
    };

    storage = {
      getReceiptStream: vi.fn(),
    };

    service = new OrderService(prisma, storage);
  });

  describe('generateOrderNumber', () => {
    it('باید شماره سفارشی با پیشوند SE- و طول ۱۱ کاراکتر از الفبای مجاز تولید کند', () => {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toMatch(/^SE-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
      expect(orderNumber.length).toBe(11);
      // کاراکترهای ابهام‌دار نباید وجود داشته باشند
      expect(orderNumber).not.toMatch(/[01IOio]/);
    });
  });

  describe('createOrder', () => {
    const validDto = {
      addressId: 1,
      paymentMethod: 'CARD_TO_CARD' as const,
      items: [
        { productId: 10, quantity: 2 },
        { productId: 20, quantity: 1 },
      ],
      note: 'لطفاً زنگ واحد ۳ را بزنید',
    };

    const mockAddress = {
      id: 1,
      userId: 100,
      receiverName: 'علی محمدی',
      receiverPhone: '09123456789',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان لاله زار جنوبی پلاک ۱۰',
      postalCode: '1234567890',
    };

    const mockProducts = [
      {
        id: 10,
        title: 'کلید دوپل مینیاتوری',
        price: 150000,
        discountPrice: 120000,
        stock: 10,
        isActive: true,
        category: { id: 2, isActive: true },
      },
      {
        id: 20,
        title: 'پریز برق ارت دار',
        price: 80000,
        discountPrice: null,
        stock: 5,
        isActive: true,
        category: { id: 2, isActive: true },
      },
    ];

    it('۱. در صورت وجود کالای تکراری در اقلام سفارش باید خطای BadRequest دهد', async () => {
      const duplicateDto = {
        ...validDto,
        items: [
          { productId: 10, quantity: 1 },
          { productId: 10, quantity: 2 },
        ],
      };

      await expect(service.createOrder(100, duplicateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('۲. در صورت عدم وجود آدرس یا تعلق نداشتن به کاربر باید خطای NotFound دهد', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(service.createOrder(100, validDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.address.findFirst).toHaveBeenCalledWith({
        where: { id: validDto.addressId, userId: 100 },
      });
    });

    it('۳. در صورت وجود ۳ سفارش یا بیشتر در وضعیت انتظار پرداخت (Anti-abuse) باید خطای Conflict دهد', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.order.count.mockResolvedValue(3);

      await expect(service.createOrder(100, validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 100,
          status: OrderStatus.PENDING,
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        },
      });
    });

    it('۴. در صورت پیدا نشدن محصول باید خطای BadRequest دهد', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.order.count.mockResolvedValue(0);
      prisma.product.findMany.mockResolvedValue([mockProducts[0]]); // محصول ۲۰ نیست

      await expect(service.createOrder(100, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('۵. در صورت غیرفعال بودن محصول باید خطای BadRequest دهد', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.order.count.mockResolvedValue(0);
      prisma.product.findMany.mockResolvedValue([
        { ...mockProducts[0], isActive: false },
        mockProducts[1],
      ]);

      await expect(service.createOrder(100, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('۶. در صورت غیرفعال بودن دسته‌بندی محصول باید خطای BadRequest دهد', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.order.count.mockResolvedValue(0);
      prisma.product.findMany.mockResolvedValue([
        mockProducts[0],
        {
          ...mockProducts[1],
          category: { id: 2, isActive: false },
        },
      ]);

      await expect(service.createOrder(100, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('۷. در صورت عدم کفایت موجودی در ترنزکشن باید خطای Conflict دهد و موجودی کسر نشود', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.order.count.mockResolvedValue(0);
      prisma.product.findMany.mockResolvedValue(mockProducts);
      // فرض کنیم برای محصول دوم موجودی کم بود
      prisma.product.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(service.createOrder(100, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('۸. ثبت موفق سفارش: قیمت اسنپ‌شات با تخفیف، هزینه ارسال 0، اسنپ‌شات آدرس و حذف adminNote', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress);
      prisma.order.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue(mockProducts);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUnique.mockResolvedValue(null);

      // محاسبه قیمت مورد انتظار:
      // محصول ۱۰: تخفیف‌دار 120,000 * 2 = 240,000
      // محصول ۲۰: بدون تخفیف 80,000 * 1 = 80,000
      // جمع اقلام = 320,000
      const expectedItemsPrice = 320000;

      const createdOrderWithAdminNote = {
        id: 50,
        userId: 100,
        orderNumber: 'SE-ABCDEFGH',
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.CARD_TO_CARD,
        paymentStatus: PaymentStatus.PENDING,
        itemsPrice: expectedItemsPrice,
        shippingPrice: 0,
        totalPrice: expectedItemsPrice,
        receiverName: mockAddress.receiverName,
        receiverPhone: mockAddress.receiverPhone,
        province: mockAddress.province,
        city: mockAddress.city,
        addressLine: mockAddress.addressLine,
        postalCode: mockAddress.postalCode,
        note: validDto.note,
        adminNote: 'یادداشت محرمانه ادمین',
        items: [
          {
            id: 1,
            productId: 10,
            title: 'کلید دوپل مینیاتوری',
            price: 120000,
            quantity: 2,
          },
          {
            id: 2,
            productId: 20,
            title: 'پریز برق ارت دار',
            price: 80000,
            quantity: 1,
          },
        ],
      };

      prisma.order.create.mockResolvedValue(createdOrderWithAdminNote);

      const result = await service.createOrder(100, validDto);

      // بررسی کسر شرطی موجودی در ترنزکشن
      expect(prisma.product.updateMany).toHaveBeenCalledTimes(2);

      // بررسی پارامترهای ثبت سفارش
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 100,
            itemsPrice: expectedItemsPrice,
            shippingPrice: 0,
            totalPrice: expectedItemsPrice,
            receiverName: mockAddress.receiverName,
            receiverPhone: mockAddress.receiverPhone,
            province: mockAddress.province,
            city: mockAddress.city,
            addressLine: mockAddress.addressLine,
            postalCode: mockAddress.postalCode,
            note: validDto.note,
          }),
        }),
      );

      // خروجی نهایی خریدار نباید شامل adminNote باشد
      expect(result).not.toHaveProperty('adminNote');
      expect((result as any).adminNote).toBeUndefined();
      expect(result.id).toBe(50);
      expect(result.totalPrice).toBe(320000);
      expect(result.items.length).toBe(2);
    });
  });

  describe('getReceiptStreamForUser', () => {
    it('اگر سفارش متعلق به کاربر نباشد باید 404 بدهد', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 999, // کاربر دیگر
        receiptUrl: 'receipts/test.jpg',
      });

      await expect(service.getReceiptStreamForUser(1, 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('اگر فیش ثبت نشده باشد باید 404 بدهد', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        receiptUrl: null,
      });

      await expect(service.getReceiptStreamForUser(1, 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('اگر کاربر مالک باشد و فیش وجود داشته باشد استریم را برمی‌گرداند', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        receiptUrl: 'receipts/test.jpg',
      });
      storage.getReceiptStream.mockReturnValue({
        stream: {},
        mimeType: 'image/jpeg',
      });

      const res = await service.getReceiptStreamForUser(1, 100);
      expect(res.mimeType).toBe('image/jpeg');
      expect(storage.getReceiptStream).toHaveBeenCalledWith(
        'receipts/test.jpg',
      );
    });
  });
});

