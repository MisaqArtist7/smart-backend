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
});
