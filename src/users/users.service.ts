import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Role } from '../generated/prisma/client.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            orders: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`کاربر با شناسه ${id} یافت نشد`);
    }

    return user;
  }

  async updateUser(id: number, dto: UpdateUserDto, currentUserId?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`کاربر با شناسه ${id} یافت نشد`);
    }

    // امنیت: ادمین جاری نمی‌تواند نقش خودش را از ادمین به مشتری تغییر دهد
    if (
      currentUserId &&
      currentUserId === id &&
      dto.role !== undefined &&
      dto.role !== Role.ADMIN &&
      user.role === Role.ADMIN
    ) {
      throw new BadRequestException(
        'شما نمی‌توانید دسترسی ادمین حساب کاربری خودتان را لغو کنید',
      );
    }

    // بررسی یکتایی شماره موبایل در صورت تغییر
    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'این شماره موبایل قبلاً برای کاربر دیگری ثبت شده است',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            comments: true,
          },
        },
      },
    });
  }
}
