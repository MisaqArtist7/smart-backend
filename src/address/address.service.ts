import {
  BadRequestException,
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
  secondaryPhone: true,
  provinceId: true,
  cityId: true,
  province: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  city: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  streetAddress: true,
  plaque: true,
  unit: true,
  floor: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  private validatePhonesDifferent(
    primaryPhone: string,
    secondaryPhone?: string | null,
  ) {
    if (secondaryPhone && secondaryPhone === primaryPhone) {
      throw new BadRequestException(
        'شماره تماس دوم نمی‌تواند با شماره تماس اصلی یکسان باشد',
      );
    }
  }

  private async validateProvinceAndCity(provinceId: number, cityId: number) {
    const [province, city] = await Promise.all([
      this.prisma.province.findUnique({
        where: { id: provinceId },
        select: { id: true, isActive: true },
      }),
      this.prisma.city.findUnique({
        where: { id: cityId },
        select: { id: true, provinceId: true, isActive: true },
      }),
    ]);

    if (!province || !province.isActive) {
      throw new BadRequestException('استان انتخاب‌شده معتبر یا فعال نیست');
    }

    if (!city || !city.isActive) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر یا فعال نیست');
    }

    if (city.provinceId !== provinceId) {
      throw new BadRequestException(
        'شهر انتخاب‌شده متعلق به استان انتخاب‌شده نیست',
      );
    }
  }

  async createAddress(userId: number, dto: CreateAddressDto) {
    this.validatePhonesDifferent(dto.receiverPhone, dto.secondaryPhone);
    await this.validateProvinceAndCity(dto.provinceId, dto.cityId);

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
          receiverPhone: dto.receiverPhone,
          secondaryPhone: dto.secondaryPhone ?? null,
          provinceId: dto.provinceId,
          cityId: dto.cityId,
          streetAddress: dto.streetAddress.trim(),
          plaque: dto.plaque.trim(),
          unit: dto.unit?.trim() || null,
          floor: dto.floor?.trim() || null,
          postalCode: dto.postalCode ?? null,
          isDefault,
        },
        select: addressSelect,
      });
    });
  }

  async getMyAddresses(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      select: addressSelect,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

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

  async updateAddress(id: number, userId: number, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Address not found');
    }

    if (dto.provinceId !== undefined || dto.cityId !== undefined) {
      const targetProvinceId = dto.provinceId ?? existing.provinceId;
      const targetCityId = dto.cityId ?? existing.cityId;
      await this.validateProvinceAndCity(targetProvinceId, targetCityId);
    }

    const finalPrimary = dto.receiverPhone ?? existing.receiverPhone;
    const finalSecondary =
      dto.secondaryPhone !== undefined
        ? dto.secondaryPhone || null
        : existing.secondaryPhone;
    this.validatePhonesDifferent(finalPrimary, finalSecondary);

    return this.prisma.address.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.receiverName !== undefined
          ? { receiverName: dto.receiverName.trim() }
          : {}),
        ...(dto.receiverPhone !== undefined
          ? { receiverPhone: dto.receiverPhone }
          : {}),
        ...(dto.secondaryPhone !== undefined
          ? { secondaryPhone: dto.secondaryPhone || null }
          : {}),
        ...(dto.provinceId !== undefined ? { provinceId: dto.provinceId } : {}),
        ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
        ...(dto.streetAddress !== undefined
          ? { streetAddress: dto.streetAddress.trim() }
          : {}),
        ...(dto.plaque !== undefined ? { plaque: dto.plaque.trim() } : {}),
        ...(dto.unit !== undefined
          ? { unit: dto.unit ? dto.unit.trim() : null }
          : {}),
        ...(dto.floor !== undefined
          ? { floor: dto.floor ? dto.floor.trim() : null }
          : {}),
        ...(dto.postalCode !== undefined
          ? { postalCode: dto.postalCode || null }
          : {}),
      },
      select: addressSelect,
    });
  }

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
