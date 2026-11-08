import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../src/generated/prisma/client.js';

describe('Address Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let users: any[];
  let addresses: any[];
  let nextAddressId = 1;

  let user1Token: string;
  let user2Token: string;

  const mockPrisma = {
    user: {
      findUnique: async ({ where }: any) => {
        return users.find((u) => u.id === where.id) || null;
      },
    },
    address: {
      count: async ({ where }: any) => {
        return addresses.filter((a) => {
          if (where?.userId && a.userId !== where.userId) return false;
          return true;
        }).length;
      },
      findFirst: async ({ where, orderBy, select }: any) => {
        let list = addresses.filter((a) => {
          if (where?.id && a.id !== where.id) return false;
          if (where?.userId && a.userId !== where.userId) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          list = list.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        }
        const found = list[0] || null;
        if (found && select) {
          const { userId: _, ...safe } = found;
          return safe;
        }
        return found;
      },
      findMany: async ({ where, orderBy, select }: any) => {
        let list = addresses.filter((a) => {
          if (where?.userId && a.userId !== where.userId) return false;
          return true;
        });
        if (Array.isArray(orderBy)) {
          list = list.sort((a, b) => {
            if (a.isDefault !== b.isDefault) {
              return b.isDefault ? 1 : -1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
        if (select) {
          return list.map((a) => {
            const { userId: _, ...safe } = a;
            return safe;
          });
        }
        return list;
      },
      create: async ({ data, select }: any) => {
        const id = nextAddressId++;
        const newAddress = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        addresses.push(newAddress);
        if (select) {
          const { userId: _, ...safe } = newAddress;
          return safe;
        }
        return newAddress;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        addresses.forEach((a) => {
          if (where?.userId && a.userId === where.userId) {
            Object.assign(a, data);
            count++;
          }
        });
        return { count };
      },
      update: async ({ where, data, select }: any) => {
        const idx = addresses.findIndex((a) => a.id === where.id);
        if (idx === -1) throw new Error('Address not found');
        addresses[idx] = {
          ...addresses[idx],
          ...data,
          updatedAt: new Date(),
        };
        if (select) {
          const { userId: _, ...safe } = addresses[idx];
          return safe;
        }
        return addresses[idx];
      },
      delete: async ({ where }: any) => {
        const idx = addresses.findIndex((a) => a.id === where.id);
        if (idx === -1) throw new Error('Address not found');
        const [deleted] = addresses.splice(idx, 1);
        return deleted;
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
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
    nextAddressId = 1;
    users = [
      { id: 1, name: 'کاربر یک', phone: '09121111111', role: Role.USER, isActive: true },
      { id: 2, name: 'کاربر دو', phone: '09122222222', role: Role.USER, isActive: true },
    ];
    addresses = [];

    user1Token = jwtService.sign({ sub: 1, role: Role.USER });
    user2Token = jwtService.sign({ sub: 2, role: Role.USER });
  });

  it('۱. درخواست بدون کوکی احراز هویت باید 401 Unauthorized بدهد', async () => {
    const res = await request(app.getHttpServer()).get('/addresses');
    expect(res.status).toBe(401);
  });

  it('۲. اولین آدرس ثبت‌شده برای کاربر باید به طور خودکار پیش‌فرض (isDefault=true) شود و userId نداشته باشد', async () => {
    const res = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: '  منزل تهران  ',
        receiverName: '  علی رضایی  ',
        receiverPhone: '09121111111',
        province: '  تهران  ',
        city: '  تهران  ',
        addressLine: '  خیابان لاله زار جنوبی پلاک ۱۰  ',
        postalCode: '1234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.title).toBe('منزل تهران');
    expect(res.body.isDefault).toBe(true);
    expect(res.body.userId).toBeUndefined();
  });

  it('۳. آدرس دوم ثبت‌شده باید با isDefault=false ثبت شود', async () => {
    // ثبت آدرس اول
    await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'منزل',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان لاله زار پلاک ۱۰',
        postalCode: '1234567890',
      });

    // ثبت آدرس دوم
    const res = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'محل کار',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان مطهری پلاک ۲۰',
        postalCode: '9876543210',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(2);
    expect(res.body.title).toBe('محل کار');
    expect(res.body.isDefault).toBe(false);
  });

  it('۴. ارسال فیلدهای اضافی مثل userId یا isDefault در بدنه باید خطای 400 بدهد (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'منزل',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان لاله زار پلاک ۱۰',
        postalCode: '1234567890',
        userId: 999, // فیلد ممنوع
        isDefault: true, // فیلد ممنوع
      });

    expect(res.status).toBe(400);
  });

  it('۵. شماره موبایل یا کد پستی نامعتبر باید خطای 400 بدهد', async () => {
    // موبایل نامعتبر
    const resPhone = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'منزل',
        receiverName: 'علی رضایی',
        receiverPhone: '08123456789', // نامعتبر
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان لاله زار پلاک ۱۰',
        postalCode: '1234567890',
      });
    expect(resPhone.status).toBe(400);

    // کد پستی نامعتبر (کمتر یا بیشتر از ۱۰ رقم یا دارای حروف)
    const resPostal = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'منزل',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان لاله زار پلاک ۱۰',
        postalCode: '12345', // نامعتبر
      });
    expect(resPostal.status).toBe(400);
  });

  it('۶. دریافت لیست آدرس‌ها باید ابتدا آدرس پیش‌فرض و سپس جدیدترین را برگرداند', async () => {
    // آدرس ۱ (پیش‌فرض)
    await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۱',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۱',
        postalCode: '1111111111',
      });

    // آدرس ۲ (غیر پیش‌فرض)
    await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۲',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۲',
        postalCode: '2222222222',
      });

    const res = await request(app.getHttpServer())
      .get('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].isDefault).toBe(true);
    expect(res.body[0].title).toBe('آدرس ۱');
    expect(res.body[1].isDefault).toBe(false);
    expect(res.body[0].userId).toBeUndefined();
  });

  it('۷. کاربر نمی‌تواند آدرس کاربر دیگر را مشاهده یا ویرایش کند (404 Not Found)', async () => {
    // کاربر ۱ یک آدرس ایجاد می‌کند
    const createRes = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس کاربر ۱',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۱',
        postalCode: '1111111111',
      });
    const addressId = createRes.body.id;

    // کاربر ۲ تلاش می‌کند آدرس کاربر ۱ را بخواند
    const getRes = await request(app.getHttpServer())
      .get(`/addresses/${addressId}`)
      .set('Cookie', [`accessToken=${user2Token}`]);
    expect(getRes.status).toBe(404);

    // کاربر ۲ تلاش می‌کند آدرس کاربر ۱ را ویرایش کند
    const patchRes = await request(app.getHttpServer())
      .patch(`/addresses/${addressId}`)
      .set('Cookie', [`accessToken=${user2Token}`])
      .send({ title: 'هک آدرس' });
    expect(patchRes.status).toBe(404);

    // کاربر ۲ تلاش می‌کند آدرس کاربر ۱ را پیش‌فرض کند
    const defaultRes = await request(app.getHttpServer())
      .patch(`/addresses/${addressId}/default`)
      .set('Cookie', [`accessToken=${user2Token}`]);
    expect(defaultRes.status).toBe(404);

    // کاربر ۲ تلاش می‌کند آدرس کاربر ۱ را حذف کند
    const deleteRes = await request(app.getHttpServer())
      .delete(`/addresses/${addressId}`)
      .set('Cookie', [`accessToken=${user2Token}`]);
    expect(deleteRes.status).toBe(404);
  });

  it('۸. پیش‌فرض کردن آدرس: آدرس قبلی false و آدرس انتخابی true می‌شود (PATCH /addresses/:id/default)', async () => {
    // ایجاد دو آدرس
    await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۱',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۱',
        postalCode: '1111111111',
      });

    const res2 = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۲',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۲',
        postalCode: '2222222222',
      });
    const address2Id = res2.body.id;

    // پیش‌فرض کردن آدرس ۲
    const defaultRes = await request(app.getHttpServer())
      .patch(`/addresses/${address2Id}/default`)
      .set('Cookie', [`accessToken=${user1Token}`]);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.isDefault).toBe(true);

    // بررسی لیست: آدرس ۲ باید پیش‌فرض شده باشد و آدرس ۱ دیگر پیش‌فرض نباشد
    const listRes = await request(app.getHttpServer())
      .get('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`]);
    expect(listRes.body[0].id).toBe(address2Id);
    expect(listRes.body[0].isDefault).toBe(true);
    expect(listRes.body[1].isDefault).toBe(false);
  });

  it('۹. حذف آدرس پیش‌فرض: جدیدترین آدرس باقی‌مانده پیش‌فرض می‌شود (Delete default promotes another)', async () => {
    // ایجاد سه آدرس
    const res1 = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۱ (قدیمی)',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۱',
        postalCode: '1111111111',
      });
    const id1 = res1.body.id; // این پیش‌فرض شد

    const res2 = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۲ (جدیدتر)',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ۲',
        postalCode: '2222222222',
      });
    const id2 = res2.body.id;

    // حذف آدرس ۱ که پیش‌فرض بود
    const delRes = await request(app.getHttpServer())
      .delete(`/addresses/${id1}`)
      .set('Cookie', [`accessToken=${user1Token}`]);
    expect(delRes.status).toBe(200);

    // بررسی آدرس باقی‌مانده: آدرس ۲ باید اکنون isDefault=true شده باشد
    const listRes = await request(app.getHttpServer())
      .get('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`]);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(id2);
    expect(listRes.body[0].isDefault).toBe(true);
  });

  it('۱۰. ثبت آدرس یازدهم باید خطای 409 Conflict دهد (11th address returns 409)', async () => {
    // ثبت ۱۰ آدرس
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post('/addresses')
        .set('Cookie', [`accessToken=${user1Token}`])
        .send({
          title: `آدرس ${i}`,
          receiverName: 'علی رضایی',
          receiverPhone: '09121111111',
          province: 'تهران',
          city: 'تهران',
          addressLine: `خیابان شماره ${i}`,
          postalCode: '1234567890',
        });
      expect(res.status).toBe(201);
    }

    // آدرس یازدهم
    const res11 = await request(app.getHttpServer())
      .post('/addresses')
      .set('Cookie', [`accessToken=${user1Token}`])
      .send({
        title: 'آدرس ۱۱',
        receiverName: 'علی رضایی',
        receiverPhone: '09121111111',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان شماره ۱۱',
        postalCode: '1234567890',
      });

    expect(res11.status).toBe(409);
    expect(res11.body.message).toContain('limit reached');
  });
});
