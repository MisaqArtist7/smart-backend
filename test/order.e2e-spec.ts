import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import {
  OrderStatus,
  PaymentStatus,
  Role,
} from '../src/generated/prisma/client.js';

describe('Order Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  // وضعیت حافظه برای شبیه‌سازی تست دابل پریزما
  let users: any[];
  let products: any[];
  let categories: any[];
  let addresses: any[];
  let orders: any[];
  let nextOrderId = 1;

  let buyer1Token: string;
  let buyer2Token: string;
  let adminToken: string;

  const mockPrisma = {
    user: {
      findUnique: async ({ where }: any) => {
        return users.find((u) => u.id === where.id) || null;
      },
    },
    address: {
      findFirst: async ({ where }: any) => {
        return (
          addresses.find(
            (a) => a.id === where.id && a.userId === where.userId,
          ) || null
        );
      },
    },
    category: {
      findUnique: async ({ where }: any) => {
        return categories.find((c) => c.id === where.id) || null;
      },
    },
    product: {
      findMany: async ({ where }: any) => {
        const ids = where?.id?.in || [];
        return products
          .filter((p) => ids.includes(p.id))
          .map((p) => ({
            ...p,
            category: categories.find((c) => c.id === p.categoryId),
          }));
      },
      findUnique: async ({ where }: any) => {
        return products.find((p) => p.id === where.id) || null;
      },
      updateMany: async ({ where, data }: any) => {
        const p = products.find((prod) => prod.id === where.id);
        if (!p) return { count: 0 };
        const minStock = where?.stock?.gte ?? 0;
        if (p.stock >= minStock) {
          if (data?.stock?.decrement) {
            p.stock -= data.stock.decrement;
          }
          return { count: 1 };
        }
        return { count: 0 };
      },
      update: async ({ where, data }: any) => {
        const p = products.find((prod) => prod.id === where.id);
        if (!p) throw new Error('Product not found');
        if (data?.stock?.increment) {
          p.stock += data.stock.increment;
        }
        return p;
      },
    },
    order: {
      count: async ({ where }: any) => {
        return orders.filter((o) => {
          if (where?.userId && o.userId !== where.userId) return false;
          if (where?.status && o.status !== where.status) return false;
          if (where?.paymentStatus) {
            if (where.paymentStatus.in) {
              if (!where.paymentStatus.in.includes(o.paymentStatus)) return false;
            } else if (o.paymentStatus !== where.paymentStatus) {
              return false;
            }
          }
          return true;
        }).length;
      },
      findUnique: async ({ where }: any) => {
        const order = orders.find((o) => o.id === where.id || o.orderNumber === where.orderNumber);
        if (!order) return null;
        return {
          ...order,
          user: users.find((u) => u.id === order.userId),
        };
      },
      findFirst: async ({ where }: any) => {
        const order = orders.find((o) => {
          if (where.id && o.id !== where.id) return false;
          if (where.userId && o.userId !== where.userId) return false;
          return true;
        });
        return order || null;
      },
      findMany: async ({ where, skip, take }: any) => {
        let filtered = orders.filter((o) => {
          if (where?.userId && o.userId !== where.userId) return false;
          if (where?.status && o.status !== where.status) return false;
          if (where?.paymentStatus && o.paymentStatus !== where.paymentStatus) return false;
          return true;
        });
        filtered = filtered.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const paged = filtered.slice(skip || 0, (skip || 0) + (take || 10));
        return paged.map((o) => ({
          ...o,
          user: users.find((u) => u.id === o.userId),
        }));
      },
      create: async ({ data }: any) => {
        const orderId = nextOrderId++;
        const items = (data.items?.create || []).map((it: any, idx: number) => ({
          id: idx + 1,
          orderId,
          ...it,
        }));
        const newOrder = {
          id: orderId,
          ...data,
          items,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        orders.push(newOrder);
        return newOrder;
      },
      update: async ({ where, data }: any) => {
        const idx = orders.findIndex((o) => o.id === where.id);
        if (idx === -1) throw new Error('Order not found');
        orders[idx] = {
          ...orders[idx],
          ...data,
          updatedAt: new Date(),
        };
        return {
          ...orders[idx],
          user: users.find((u) => u.id === orders[idx].userId),
        };
      },
    },
    $transaction: async (cb: any) => {
      return cb(mockPrisma);
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    nextOrderId = 1;
    users = [
      {
        id: 101,
        name: 'خریدار شماره یک',
        phone: '09121111111',
        role: Role.USER,
        isActive: true,
      },
      {
        id: 102,
        name: 'خریدار شماره دو',
        phone: '09122222222',
        role: Role.USER,
        isActive: true,
      },
      {
        id: 999,
        name: 'مدیر فروشگاه',
        phone: '09129999999',
        role: Role.ADMIN,
        isActive: true,
      },
    ];

    categories = [
      { id: 1, name: 'کلید و پریز', isActive: true },
      { id: 2, name: 'سیم و کابل غیرفعال', isActive: false },
    ];

    products = [
      {
        id: 1,
        title: 'کلید دوپل لوکس',
        price: 200000,
        discountPrice: 150000,
        stock: 10,
        isActive: true,
        categoryId: 1,
      },
      {
        id: 2,
        title: 'کالای تک واحدی',
        price: 300000,
        discountPrice: null,
        stock: 1, // فقط ۱ عدد در انبار موجود است (برای تست رقابت همزمان)
        isActive: true,
        categoryId: 1,
      },
      {
        id: 3,
        title: 'کالای غیرفعال',
        price: 50000,
        discountPrice: null,
        stock: 5,
        isActive: false, // غیرفعال
        categoryId: 1,
      },
      {
        id: 4,
        title: 'کالای دسته‌بندی غیرفعال',
        price: 90000,
        discountPrice: null,
        stock: 5,
        isActive: true,
        categoryId: 2, // دسته‌بندی غیرفعال
      },
    ];

    addresses = [
      {
        id: 1,
        userId: 101,
        receiverName: 'خریدار شماره یک',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان لاله زار جنوبی پلاک ۱',
        postalCode: '1111111111',
      },
      {
        id: 2,
        userId: 102,
        receiverName: 'خریدار شماره دو',
        receiverPhone: '09122222222',
        province: 'اصفهان',
        city: 'اصفهان',
        addressLine: 'خیابان چهارباغ پلاک ۲',
        postalCode: '2222222222',
      },
    ];

    orders = [];

    buyer1Token = jwtService.sign({ sub: 101, role: Role.USER });
    buyer2Token = jwtService.sign({ sub: 102, role: Role.USER });
    adminToken = jwtService.sign({ sub: 999, role: Role.ADMIN });
  });

  it('۱. محاسبه قیمت سمت سرور: قیمت‌های جعلی کلاینت نادیده گرفته می‌شوند (Server-side pricing)', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [
          // کلاینت تلاش می‌کند قیمت جعلی ۱۰۰ تومان بفرستد، ولی DTO و سرور اجازه نمی‌دهند
          { productId: 1, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    // قیمت تخفیف‌دار محصول ۱ برابر ۱۵۰,۰۰۰ تومان است؛ برای ۲ عدد = ۳۰۰,۰۰۰ تومان
    expect(res.body.itemsPrice).toBe(300000);
    expect(res.body.shippingPrice).toBe(0);
    expect(res.body.totalPrice).toBe(300000);
    expect(res.body.status).toBe(OrderStatus.PENDING);
    expect(res.body.paymentStatus).toBe(PaymentStatus.PENDING);
    // عدم افشای adminNote به خریدار
    expect(res.body.adminNote).toBeUndefined();
    // کسر ۲ عدد از موجودی ۱۰ -> موجودی باقی‌مانده ۸
    const p1 = products.find((p) => p.id === 1);
    expect(p1.stock).toBe(8);
  });

  it('۲. عدم کفایت موجودی انبار خطای ۴۰۹ برمی‌گرداند (Insufficient stock returns 409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 2, quantity: 5 }], // موجودی محصول ۲ فقط ۱ عدد است
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('موجودی');
    // موجودی نباید کسر شده باشد
    const p2 = products.find((p) => p.id === 2);
    expect(p2.stock).toBe(1);
  });

  it('۳. رقابت همزمان دو سفارش برای آخرین واحد کالا: فقط یکی موفق می‌شود (Concurrent orders for last unit)', async () => {
    // کالای ۲ فقط ۱ عدد در انبار دارد
    const req1 = request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 2, quantity: 1 }],
      });

    const req2 = request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer2Token}`])
      .send({
        addressId: 2,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 2, quantity: 1 }],
      });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status];

    // دقیقاً یکی 201 و دیگری 409
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // موجودی کالا به ۰ رسیده است
    const p2 = products.find((p) => p.id === 2);
    expect(p2.stock).toBe(0);
  });

  it('۴. یک کاربر نمی‌تواند سفارش کاربر دیگری را مشاهده یا لغو کند (404 Not Found)', async () => {
    // خریدار ۱ یک سفارش ثبت می‌کند
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 1, quantity: 1 }],
      });
    const orderId = orderRes.body.id;

    // خریدار ۲ تلاش می‌کند سفارش خریدار ۱ را بخواند
    const getRes = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Cookie', [`accessToken=${buyer2Token}`]);
    expect(getRes.status).toBe(404);

    // خریدار ۲ تلاش می‌کند سفارش خریدار ۱ را لغو کند
    const cancelRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/cancel`)
      .set('Cookie', [`accessToken=${buyer2Token}`]);
    expect(cancelRes.status).toBe(404);
  });

  it('۵. کالای غیرفعال یا کالای دارای دسته‌بندی غیرفعال قابل سفارش نیست (400 Bad Request)', async () => {
    // کالای ۳ غیرفعال است
    const resInactiveProd = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 3, quantity: 1 }],
      });
    expect(resInactiveProd.status).toBe(400);
    expect(resInactiveProd.body.message).toContain('غیرفعال');

    // کالای ۴ دسته‌بندی‌اش غیرفعال است
    const resInactiveCat = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 4, quantity: 1 }],
      });
    expect(resInactiveCat.status).toBe(400);
    expect(resInactiveCat.body.message).toContain('دسته‌بندی');
  });

  it('۶. قوانین آپلود فیش: اعتبارسنجی بایت‌های جادویی، حجم و وضعیت‌ها (Receipt rules)', async () => {
    // ایجاد یک سفارش معلق
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 1, quantity: 1 }],
      });
    const orderId = orderRes.body.id;

    // الف) ارسال فایل با بایت‌های جادویی نامعتبر (متنی ساده به جای عکس)
    const fakeFileRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/receipt`)
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .attach('receipt', Buffer.from('hello plain text'), 'test.jpg');
    expect(fakeFileRes.status).toBe(400);
    expect(fakeFileRes.body.message).toContain('فرمت');

    // ب) آپلود فیش معتبر JPEG (بایت‌های جادویی FF D8 FF)
    const validJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const validUploadRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/receipt`)
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .attach('receipt', validJpegBuffer, 'receipt.jpg');
    expect(validUploadRes.status).toBe(200);
    expect(validUploadRes.body.paymentStatus).toBe(PaymentStatus.WAITING_REVIEW);
    expect(validUploadRes.body.receiptUrl).toBeDefined();

    // ج) آپلود مجدد در حالی که وضعیت در انتظار بررسی (WAITING_REVIEW) است باید ۴۰۹ بدهد
    const duplicateUploadRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/receipt`)
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .attach('receipt', validJpegBuffer, 'receipt2.jpg');
    expect(duplicateUploadRes.status).toBe(409);
  });

  it('۷. انتقالات وضعیت مجاز و غیرمجاز سفارش (Valid and invalid status transitions)', async () => {
    // ایجاد سفارش و آپلود فیش
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 1, quantity: 1 }],
      });
    const orderId = orderRes.body.id;

    const validJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    await request(app.getHttpServer())
      .post(`/orders/${orderId}/receipt`)
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .attach('receipt', validJpegBuffer, 'receipt.jpg');

    // ۱. ادمین پرداخت را تایید می‌کند (approve) -> وضعیت CONFIRMED و پرداخت PAID
    const approveRes = await request(app.getHttpServer())
      .patch(`/admin/orders/${orderId}/payment`)
      .set('Cookie', [`accessToken=${adminToken}`])
      .send({ action: 'approve', adminNote: 'پرداخت تایید شد' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe(OrderStatus.CONFIRMED);
    expect(approveRes.body.paymentStatus).toBe(PaymentStatus.PAID);
    expect(approveRes.body.paidAt).toBeDefined();

    // ۲. انتقال غیرمجاز: جهش مستقیم از CONFIRMED به DELIVERED باید ۴۰۹ بدهد
    const invalidJumpRes = await request(app.getHttpServer())
      .patch(`/admin/orders/${orderId}/status`)
      .set('Cookie', [`accessToken=${adminToken}`])
      .send({ status: OrderStatus.DELIVERED });
    expect(invalidJumpRes.status).toBe(409);

    // ۳. انتقال مجاز: از CONFIRMED به SHIPPED همراه با کد رهگیری
    const shippedRes = await request(app.getHttpServer())
      .patch(`/admin/orders/${orderId}/status`)
      .set('Cookie', [`accessToken=${adminToken}`])
      .send({
        status: OrderStatus.SHIPPED,
        trackingCode: 'TRACK123456789',
      });
    expect(shippedRes.status).toBe(200);
    expect(shippedRes.body.status).toBe(OrderStatus.SHIPPED);
    expect(shippedRes.body.trackingCode).toBe('TRACK123456789');

    // ۴. انتقال مجاز: از SHIPPED به DELIVERED
    const deliveredRes = await request(app.getHttpServer())
      .patch(`/admin/orders/${orderId}/status`)
      .set('Cookie', [`accessToken=${adminToken}`])
      .send({ status: OrderStatus.DELIVERED });
    expect(deliveredRes.status).toBe(200);
    expect(deliveredRes.body.status).toBe(OrderStatus.DELIVERED);
  });

  it('۸. لغو سفارش موجودی انبار را دقیقاً یک بار بازمی‌گرداند (Cancel restores stock exactly once)', async () => {
    // موجودی محصول ۱ در ابتدا ۱۰ عدد است
    const initialStock = products.find((p) => p.id === 1).stock;

    // خریدار ۱ سفارشی برای ۲ عدد ثبت می‌کند -> موجودی ۲ تا کم می‌شود
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', [`accessToken=${buyer1Token}`])
      .send({
        addressId: 1,
        paymentMethod: 'CARD_TO_CARD',
        items: [{ productId: 1, quantity: 2 }],
      });
    const orderId = orderRes.body.id;
    expect(products.find((p) => p.id === 1).stock).toBe(initialStock - 2);

    // لغو بار اول توسط خریدار -> موفق (200 OK) و موجودی دقیقاً ۲ عدد برمی‌گردد
    const cancelRes1 = await request(app.getHttpServer())
      .post(`/orders/${orderId}/cancel`)
      .set('Cookie', [`accessToken=${buyer1Token}`]);
    expect(cancelRes1.status).toBe(200);
    expect(cancelRes1.body.status).toBe(OrderStatus.CANCELLED);
    expect(products.find((p) => p.id === 1).stock).toBe(initialStock);

    // لغو بار دوم همان سفارش -> باید ۴۰۹ بدهد و موجودی نباید دوباره اضافه شود
    const cancelRes2 = await request(app.getHttpServer())
      .post(`/orders/${orderId}/cancel`)
      .set('Cookie', [`accessToken=${buyer1Token}`]);
    expect(cancelRes2.status).toBe(409);
    expect(products.find((p) => p.id === 1).stock).toBe(initialStock); // هنوز برابر ۱۰ است و ۱۲ نشده است
  });
});
