import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ValidateDiscountDto } from './dto/validate-discount.dto.js';
import { CreateDiscountDto } from './dto/create-discount.dto.js';
import { UpdateDiscountDto } from './dto/update-discount.dto.js';
import { DiscountType } from '../generated/prisma/client.js';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(userId: number, dto: ValidateDiscountDto) {
    const cleanCode = dto.code.trim().toUpperCase();
    const discount = await this.prisma.discountCode.findUnique({
      where: { code: cleanCode },
    });

    if (!discount || !discount.isActive) {
      throw new NotFoundException('کد تخفیف معتبر نیست یا غیرفعال شده است');
    }

    const now = new Date();
    if (discount.startDate && now < discount.startDate) {
      throw new BadRequestException('زمان فعال‌سازی این کد تخفیف هنوز فرا نرسیده است');
    }
    if (discount.endDate && now > discount.endDate) {
      throw new BadRequestException('مهلت استفاده از این کد تخفیف به پایان رسیده است');
    }

    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      throw new ConflictException('سقف استفاده سراسری از این کد تخفیف تکمیل شده است');
    }

    if (discount.minOrderAmount && dto.cartAmount < discount.minOrderAmount) {
      throw new BadRequestException(
        `حداقل مبلغ خرید برای اعمال این کد تخفیف ${discount.minOrderAmount.toLocaleString('fa-IR')} تومان است`,
      );
    }

    const userUsages = await this.prisma.discountUsage.count({
      where: {
        discountCodeId: discount.id,
        userId,
      },
    });

    if (discount.userLimit && userUsages >= discount.userLimit) {
      throw new ConflictException('شما قبلاً از این کد تخفیف استفاده کرده‌اید');
    }

    let discountAmount = 0;
    if (discount.type === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((dto.cartAmount * discount.value) / 100);
      if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
        discountAmount = discount.maxDiscountAmount;
      }
    } else {
      discountAmount = Math.min(discount.value, dto.cartAmount);
    }

    const finalAmount = Math.max(0, dto.cartAmount - discountAmount);

    return {
      valid: true,
      code: discount.code,
      discountAmount,
      finalAmount,
      message: 'کد تخفیف با موفقیت اعمال شد',
    };
  }

  async findAll() {
    return this.prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const discount = await this.prisma.discountCode.findUnique({
      where: { id },
    });
    if (!discount) {
      throw new NotFoundException(`Discount with ID '${id}' not found`);
    }
    return discount;
  }

  async create(dto: CreateDiscountDto) {
    const cleanCode = dto.code.trim().toUpperCase();
    const existing = await this.prisma.discountCode.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      throw new ConflictException(`کد تخفیف «${cleanCode}» قبلاً ثبت شده است`);
    }

    return this.prisma.discountCode.create({
      data: {
        code: cleanCode,
        type: dto.type,
        value: dto.value,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        minOrderAmount: dto.minOrderAmount ?? 0,
        usageLimit: dto.usageLimit ?? null,
        userLimit: dto.userLimit ?? 1,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateDiscountDto) {
    await this.findOne(id);

    if (dto.code) {
      const cleanCode = dto.code.trim().toUpperCase();
      const existing = await this.prisma.discountCode.findUnique({
        where: { code: cleanCode },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`کد تخفیف «${cleanCode}» قبلاً ثبت شده است`);
      }
    }

    return this.prisma.discountCode.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.maxDiscountAmount !== undefined ? { maxDiscountAmount: dto.maxDiscountAmount } : {}),
        ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.userLimit !== undefined ? { userLimit: dto.userLimit } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate ? new Date(dto.startDate) : null } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        ...(dto.description !== undefined ? { description: dto.description ? dto.description.trim() : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.discountCode.delete({ where: { id } });
    return { message: 'Discount deleted' };
  }
}
