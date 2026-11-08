import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service.js';

describe('ProductService Step 6 (Active / Inactive Filtering)', () => {
  let service: ProductService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new ProductService(prisma);
  });

  it('1. لیست عمومی (getAllProducts) باید فقط محصولات فعال از دسته‌های فعال را برگرداند', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await service.getAllProducts(false);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          category: { isActive: true },
        },
      }),
    );
  });

  it('2. لیست ادمین (getAllProducts با includeInactive=true) باید تمام محصولات را بیاورد', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await service.getAllProducts(true);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it('3. جزئیات عمومی (getProduct) اگر محصول یا دسته‌اش غیرفعال باشد باید 404 بدهد', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.getProduct(1, false)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 1,
          isActive: true,
          category: { isActive: true },
        },
      }),
    );
  });

  it('4. جزئیات ادمین (getProduct با includeInactive=true) باید محصول را برگرداند حتی اگر غیرفعال باشد', async () => {
    const mockProduct = { id: 1, title: 'محصول تستی', isActive: false };
    prisma.product.findFirst.mockResolvedValue(mockProduct);

    const result = await service.getProduct(1, true);
    expect(result).toEqual(mockProduct);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
  });

  describe('Phase 8: SEO & Catalog Helpers', () => {
    it('5. جزئیات عمومی بر اساس اسلاگ (getProductBySlug) برای محصول یا دسته غیرفعال باید 404 بدهد', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getProductBySlug('test-slug', false)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'test-slug',
            isActive: true,
            category: { isActive: true },
          },
        }),
      );
    });

    it('6. جزئیات عمومی بر اساس اسلاگ (getProductBySlug) برای محصول فعال باید نتیجه را برگرداند', async () => {
      const mockProduct = { id: 1, title: 'محصول فعال', slug: 'test-slug', isActive: true };
      prisma.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.getProductBySlug('test-slug', false);
      expect(result).toEqual(mockProduct);
    });

    it('7. لیست عمومی محصولات بدون پارامترهای کوئری باید لیست تخت را حفظ کند (Backward compatibility)', async () => {
      const mockList = [{ id: 1, title: 'کالا ۱' }, { id: 2, title: 'کالا ۲' }];
      prisma.product.findMany.mockResolvedValue(mockList);

      const result = await service.getPublicProducts({});
      expect(result).toEqual(mockList);
    });

    it('8. لیست عمومی محصولات با پارامترهای صفحه‌بندی و فیلتر باید خروجی ساختاریافته برگرداند', async () => {
      const mockItems = [{ id: 1, title: 'کلید و پریز هوشمند', price: 150000 }];
      prisma.product.findMany = vi.fn().mockResolvedValue(mockItems);
      prisma.product.count = vi.fn().mockResolvedValue(1);

      const result = await service.getPublicProducts({
        page: 1,
        limit: 10,
        categoryId: 3,
        search: 'پریز',
      });

      expect(result).toEqual({
        items: mockItems,
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            category: { isActive: true },
            categoryId: 3,
            title: {
              contains: 'پریز',
              mode: 'insensitive',
            },
          }),
          skip: 0,
          take: 10,
        }),
      );
    });
  });
});
