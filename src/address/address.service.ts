import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

export const addressSelect = {
  id: true,
  title: true,
  receiverName: true,
  receiverPhone: true,
  province: true,
  city: true,
  addressLine: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ایجاد آدرس جدید برای خریدار
   * - حداکثر ۱۰ آدرس برای هر کاربر مجاز است (آدرس ۱۱ ام خطای ۴۰۹ برمی‌گرداند)
   * - اولین آدرس به صورت خودکار به عنوان پیش‌فرض (isDefault=true) ثبت می‌شود
   * - بررسی سقف و تصمیم پیش‌فرض در ترنزکشن اتمیک انجام می‌شود
   * - شناسه کاربر (userId) در پاسخ بازگردانده نمی‌شود
   */
  async createAddress(userId: number, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({
        where: { userId },
      });

      if (count >= 10) {
        throw new ConflictException(
          'Address limit reached (maximum 10 addresses per user)',
        );
      }

      const isDefault = count === 0;

      return tx.address.create({
        data: {
          userId,
          title: dto.title.trim(),
          receiverName: dto.receiverName.trim(),
          receiverPhone: dto.receiverPhone.trim(),
          province: dto.province.trim(),
          city: dto.city.trim(),
          addressLine: dto.addressLine.trim(),
          postalCode: dto.postalCode.trim(),
          isDefault,
        },
        select: addressSelect,
      });
    });
  }

  /**
   * دریافت لیست آدرس‌های کاربر جاری
   * - مرتب‌سازی: ابتدا آدرس پیش‌فرض (isDefault=true)، سپس از جدیدترین به قدیمی‌ترین
   * - شناسه کاربر (userId) در خروجی حذف شده است
   */
  async getMyAddresses(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      select: addressSelect,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * دریافت جزئیات یک آدرس متعلق به خریدار
   * - آدرس متعلق به کاربر دیگر یا ناموجود خطای ۴۰۴ می‌دهد (نه ۴۰۳)
   */
  async getMyAddressById(id: number, userId: number) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
      select: addressSelect,
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  /**
   * ویرایش جزئی آدرس خریدار
   * - فقط مالک آدرس مجاز است؛ در غیر این صورت ۴۰۴ برمی‌گردد
   */
  async updateAddress(id: number, userId: number, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    return this.prisma.address.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.receiverName !== undefined
          ? { receiverName: dto.receiverName.trim() }
          : {}),
        ...(dto.receiverPhone !== undefined
          ? { receiverPhone: dto.receiverPhone.trim() }
          : {}),
        ...(dto.province !== undefined
          ? { province: dto.province.trim() }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.addressLine !== undefined
          ? { addressLine: dto.addressLine.trim() }
          : {}),
        ...(dto.postalCode !== undefined
          ? { postalCode: dto.postalCode.trim() }
          : {}),
      },
      select: addressSelect,
    });
  }

  /**
   * پیش‌فرض کردن یک آدرس
   * - در یک ترنزکشن اتمیک: تمام آدرس‌های کاربر isDefault=false شده و این آدرس isDefault=true می‌شود
   */
  async setDefaultAddress(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: { id, userId },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id },
        data: { isDefault: true },
        select: addressSelect,
      });
    });
  }

  /**
   * حذف آدرس خریدار
   * - در یک ترنزکشن اتمیک حذف می‌شود
   * - اگر آدرس حذف‌شده پیش‌فرض بوده باشد، جدیدترین آدرس باقی‌مانده کاربر به عنوان پیش‌فرض جدید انتخاب می‌شود
   */
  async deleteAddress(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: { id, userId },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      const wasDefault = address.isDefault;

      await tx.address.delete({
        where: { id },
      });

      if (wasDefault) {
        const remaining = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (remaining) {
          await tx.address.update({
            where: { id: remaining.id },
            data: { isDefault: true },
          });
        }
      }

      return { message: 'Address deleted successfully' };
    });
  }
}

