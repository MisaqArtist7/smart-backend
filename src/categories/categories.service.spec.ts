import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CategoryService } from './categories.service.js';

describe('CategoryService Step 6 (Active / Inactive Filtering)', () => {
  let service: CategoryService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new CategoryService(prisma);
  });

  it('1. لیست عمومی (findAll) باید فقط دسته‌های فعال که والدشان هم فعال است را برگرداند', async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await service.findAll(false);

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ parentId: null }, { parent: { isActive: true } }],
        },
      }),
    );
  });

  it('2. لیست ادمین (findAll با includeInactive=true) باید تمام دسته‌ها را بیاورد', async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await service.findAll(true);

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it('3. جزئیات عمومی (findOne) اگر دسته غیرفعال باشد باید 404 بدهد', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(service.findOne(1, false)).rejects.toThrow(NotFoundException);
    expect(prisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 1,
          isActive: true,
        },
      }),
    );
  });

  it('4. جزئیات ادمین (findOne با includeInactive=true) باید دسته را حتی اگر غیرفعال باشد برگرداند', async () => {
    const mockCat = { id: 1, name: 'دسته غیرفعال', isActive: false };
    prisma.category.findFirst.mockResolvedValue(mockCat);

    const result = await service.findOne(1, true);
    expect(result).toEqual(mockCat);
    expect(prisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
      }),
    );
  });
});
