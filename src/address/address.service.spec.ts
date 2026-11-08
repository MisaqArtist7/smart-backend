import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AddressService, addressSelect } from './address.service.js';

describe('AddressService', () => {
  let service: AddressService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      address: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };
    service = new AddressService(prisma);
  });

  describe('createAddress', () => {
    const validDto = {
      title: '  منزل  ',
      receiverName: '  علی رضایی  ',
      receiverPhone: '09121234567',
      province: '  تهران  ',
      city: '  تهران  ',
      addressLine: '  خیابان ولیعصر پلاک ۱۲  ',
      postalCode: '1234567890',
    };

    it('۱. اولین آدرس کاربر باید به صورت خودکار پیش‌فرض (isDefault=true) شود', async () => {
      prisma.address.count.mockResolvedValue(0);
      prisma.address.create.mockImplementation(async ({ data }: any) => ({
        id: 1,
        ...data,
      }));

      const result = await service.createAddress(100, validDto);

      expect(prisma.address.count).toHaveBeenCalledWith({
        where: { userId: 100 },
      });
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: {
          userId: 100,
          title: 'منزل',
          receiverName: 'علی رضایی',
          receiverPhone: '09121234567',
          province: 'تهران',
          city: 'تهران',
          addressLine: 'خیابان ولیعصر پلاک ۱۲',
          postalCode: '1234567890',
          isDefault: true,
        },
        select: addressSelect,
      });
      expect(result.isDefault).toBe(true);
    });

    it('۲. آدرس‌های بعدی (غیر از اولی) باید با isDefault=false ثبت شوند', async () => {
      prisma.address.count.mockResolvedValue(1);
      prisma.address.create.mockImplementation(async ({ data }: any) => ({
        id: 2,
        ...data,
      }));

      const result = await service.createAddress(100, validDto);

      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 100,
          isDefault: false,
        }),
        select: addressSelect,
      });
      expect(result.isDefault).toBe(false);
    });

    it('۳. ایجاد آدرس یازدهم باید خطای ۴۰۹ (Conflict) بدهد', async () => {
      prisma.address.count.mockResolvedValue(10);

      await expect(service.createAddress(100, validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.address.create).not.toHaveBeenCalled();
    });
  });

  describe('getMyAddresses', () => {
    it('باید لیست آدرس‌ها را به ترتیب ابتدا پیش‌فرض و سپس جدیدترین برگرداند', async () => {
      const mockList = [
        { id: 2, title: 'محل کار', isDefault: true, createdAt: new Date() },
        { id: 1, title: 'منزل', isDefault: false, createdAt: new Date() },
      ];
      prisma.address.findMany.mockResolvedValue(mockList);

      const result = await service.getMyAddresses(100);

      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { userId: 100 },
        select: addressSelect,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('getMyAddressById', () => {
    it('اگر آدرس متعلق به کاربر باشد جزئیات آن را برمی‌گرداند', async () => {
      const mockAddress = { id: 5, title: 'منزل', isDefault: true };
      prisma.address.findFirst.mockResolvedValue(mockAddress);

      const result = await service.getMyAddressById(5, 100);

      expect(prisma.address.findFirst).toHaveBeenCalledWith({
        where: { id: 5, userId: 100 },
        select: addressSelect,
      });
      expect(result).toEqual(mockAddress);
    });

    it('اگر آدرس وجود نداشته باشد یا متعلق به کاربر دیگری باشد باید خطای ۴۰۴ دهد (نه ۴۰۳)', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(service.getMyAddressById(999, 100)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.address.findFirst).toHaveBeenCalledWith({
        where: { id: 999, userId: 100 },
        select: addressSelect,
      });
    });
  });

  describe('updateAddress', () => {
    it('ویرایش موفق آدرس متعلق به خریدار', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 5, userId: 100 });
      const updatedMock = { id: 5, title: 'عنوان جدید' };
      prisma.address.update.mockResolvedValue(updatedMock);

      const result = await service.updateAddress(5, 100, {
        title: '  عنوان جدید  ',
      });

      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { title: 'عنوان جدید' },
        select: addressSelect,
      });
      expect(result).toEqual(updatedMock);
    });

    it('اگر آدرس متعلق به دیگری باشد باید ۴۰۴ بدهد', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAddress(5, 100, { title: 'تست' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.address.update).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultAddress', () => {
    it('باید تمام آدرس‌های کاربر را false کند و این آدرس را true نماید', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 3, userId: 100 });
      const defaultMock = { id: 3, isDefault: true };
      prisma.address.update.mockResolvedValue(defaultMock);

      const result = await service.setDefaultAddress(3, 100);

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId: 100 },
        data: { isDefault: false },
      });
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { isDefault: true },
        select: addressSelect,
      });
      expect(result).toEqual(defaultMock);
    });

    it('اگر آدرس وجود نداشته باشد یا مال دیگری باشد باید ۴۰۴ بدهد', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(service.setDefaultAddress(3, 100)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.address.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteAddress', () => {
    it('حذف آدرس غیر پیش‌فرض بدون تغییر سایر آدرس‌ها', async () => {
      prisma.address.findFirst.mockResolvedValue({
        id: 4,
        userId: 100,
        isDefault: false,
      });

      const result = await service.deleteAddress(4, 100);

      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 4 } });
      // چون پیش‌فرض نبود، نباید آدرس دیگری به عنوان پیش‌فرض ست شود
      expect(prisma.address.update).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Address deleted successfully' });
    });

    it('حذف آدرس پیش‌فرض: باید جدیدترین آدرس باقی‌مانده پیش‌فرض شود', async () => {
      prisma.address.findFirst
        .mockResolvedValueOnce({ id: 2, userId: 100, isDefault: true }) // آدرس در حال حذف
        .mockResolvedValueOnce({ id: 1, userId: 100, isDefault: false }); // جدیدترین آدرس باقی‌مانده

      const result = await service.deleteAddress(2, 100);

      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(prisma.address.findFirst).toHaveBeenCalledWith({
        where: { userId: 100 },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isDefault: true },
      });
      expect(result).toEqual({ message: 'Address deleted successfully' });
    });

    it('اگر آدرس مال کاربر دیگری باشد باید ۴۰۴ بدهد', async () => {
      prisma.address.findFirst.mockResolvedValue(null);

      await expect(service.deleteAddress(2, 100)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.address.delete).not.toHaveBeenCalled();
    });
  });
});

