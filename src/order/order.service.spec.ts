import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { customerOrderSelect, OrderService } from './order.service.js';
import { generateOrderNumber } from './order.utils.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/client.js';

describe('OrderService - Order Module Tests', () => {
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
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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
      saveReceipt: vi.fn(),
      deleteFile: vi.fn(),
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

  describe('createOrder (Phase 3)', () => {
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

  describe('getMyOrders (Phase 4)', () => {
    it('باید لیست سفارش‌های کاربر را به صورت صفحه‌بندی‌شده و مرتب‌شده نزولی بر اساس تاریخ برگرداند', async () => {
      const mockOrders = [
        {
          id: 2,
          orderNumber: 'SE-ORDER222',
          itemsPrice: 100000,
          totalPrice: 100000,
          createdAt: new Date('2026-11-08T08:00:00Z'),
          items: [],
        },
        {
          id: 1,
          orderNumber: 'SE-ORDER111',
          itemsPrice: 200000,
          totalPrice: 200000,
          createdAt: new Date('2026-11-07T08:00:00Z'),
          items: [],
        },
      ];

      prisma.order.findMany.mockResolvedValue(mockOrders);
      prisma.order.count.mockResolvedValue(25);

      const result = await service.getMyOrders(100, { page: 2, limit: 10 });

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 100 },
        select: customerOrderSelect,
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });

      expect(result.data).toEqual(mockOrders);
      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it('در صورت خالی بودن لیست باید data خالی و totalPages صفر برگرداند', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      const result = await service.getMyOrders(100, { page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('getMyOrderById (Phase 4)', () => {
    it('در صورتی که سفارش متعلق به کاربر باشد جزئیات آن را برمی‌گرداند', async () => {
      const mockOrder = {
        id: 10,
        userId: 100,
        orderNumber: 'SE-XYZ12345',
        status: OrderStatus.PENDING,
        itemsPrice: 50000,
        totalPrice: 50000,
        items: [],
      };

      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getMyOrderById(10, 100);

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 10, userId: 100 },
        select: customerOrderSelect,
      });
      expect(result).toEqual(mockOrder);
      expect(result).not.toHaveProperty('adminNote');
    });

    it('در صورتی که سفارش متعلق به کاربر دیگری باشد باید 404 بدهد (نه 403)', async () => {
      // شبیه‌سازی: findFirst با شرط userId برابر 100 هیچ رکوردی پیدا نمی‌کند
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.getMyOrderById(10, 100)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 10, userId: 100 },
        select: customerOrderSelect,
      });
    });
  });

  describe('uploadReceipt (Phase 5)', () => {
    const mockFile: any = {
      fieldname: 'receipt',
      originalname: 'fish.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    };

    it('۱. اگر فایل فیش ارسال نشده باشد باید خطای BadRequest دهد', async () => {
      await expect(service.uploadReceipt(1, 100, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('۲. اگر سفارش متعلق به کاربر دیگری باشد باید خطای NotFound دهد و فایل آپلودشده را پاک کند', async () => {
      storage.saveReceipt.mockResolvedValue({
        relativePath: 'receipts/new-file.jpg',
        mimeType: 'image/jpeg',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 999, // کاربر دیگر
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
      });

      await expect(service.uploadReceipt(1, 100, mockFile)).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.deleteFile).toHaveBeenCalledWith('receipts/new-file.jpg');
    });

    it('۳. اگر وضعیت سفارش PENDING نباشد (مثلاً CANCELLED) باید خطای Conflict دهد', async () => {
      storage.saveReceipt.mockResolvedValue({
        relativePath: 'receipts/new-file.jpg',
        mimeType: 'image/jpeg',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.PENDING,
      });

      await expect(service.uploadReceipt(1, 100, mockFile)).rejects.toThrow(
        ConflictException,
      );
      expect(storage.deleteFile).toHaveBeenCalledWith('receipts/new-file.jpg');
    });

    it('۴. اگر وضعیت پرداخت قبلاً WAITING_REVIEW باشد باید خطای Conflict دهد', async () => {
      storage.saveReceipt.mockResolvedValue({
        relativePath: 'receipts/new-file.jpg',
        mimeType: 'image/jpeg',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.WAITING_REVIEW,
      });

      await expect(service.uploadReceipt(1, 100, mockFile)).rejects.toThrow(
        ConflictException,
      );
      expect(storage.deleteFile).toHaveBeenCalledWith('receipts/new-file.jpg');
    });

    it('۵. اگر وضعیت پرداخت قبلاً PAID باشد باید خطای Conflict دهد', async () => {
      storage.saveReceipt.mockResolvedValue({
        relativePath: 'receipts/new-file.jpg',
        mimeType: 'image/jpeg',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PAID,
      });

      await expect(service.uploadReceipt(1, 100, mockFile)).rejects.toThrow(
        ConflictException,
      );
      expect(storage.deleteFile).toHaveBeenCalledWith('receipts/new-file.jpg');
    });

    it('۶. آپلود موفق اولیه (وضعیت PENDING): ثبت فایل جدید و تغییر وضعیت به WAITING_REVIEW', async () => {
      storage.saveReceipt.mockResolvedValue({
        relativePath: 'receipts/new-file.jpg',
        mimeType: 'image/jpeg',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        receiptUrl: null,
      });

      const updatedOrder = {
        id: 1,
        userId: 100,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.WAITING_REVIEW,
        receiptUrl: 'receipts/new-file.jpg',
      };
      prisma.order.update.mockResolvedValue(updatedOrder);

      const result = await service.uploadReceipt(1, 100, mockFile);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          receiptUrl: 'receipts/new-file.jpg',
          paymentStatus: PaymentStatus.WAITING_REVIEW,
        },
        select: customerOrderSelect,
      });
      expect(result).toEqual(updatedOrder);
      // چون فیش قبلی وجود نداشت، deleteFile برای فایل قدیمی فراخوانی نمی‌شود
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });

    it('۷. آپلود مجدد موفق پس از رد شدن (وضعیت FAILED): پاک شدن فیش قدیمی پس از موفقیت ترنزکشن', async () => {
      storage.saveReceipt.mockResolvedValue({
        relativePath: 'receipts/new-file-2.jpg',
        mimeType: 'image/jpeg',
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 1,
        userId: 100,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.FAILED,
        receiptUrl: 'receipts/old-rejected-file.jpg',
      });

      const updatedOrder = {
        id: 1,
        userId: 100,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.WAITING_REVIEW,
        receiptUrl: 'receipts/new-file-2.jpg',
      };
      prisma.order.update.mockResolvedValue(updatedOrder);

      const result = await service.uploadReceipt(1, 100, mockFile);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          receiptUrl: 'receipts/new-file-2.jpg',
          paymentStatus: PaymentStatus.WAITING_REVIEW,
        },
        select: customerOrderSelect,
      });
      expect(result).toEqual(updatedOrder);
      // فایل قبلی ردشده باید پس از موفقیت دیتابیس پاک شود
      expect(storage.deleteFile).toHaveBeenCalledWith('receipts/old-rejected-file.jpg');
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
