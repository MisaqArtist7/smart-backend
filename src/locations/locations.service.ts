import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveProvinces() {
    return this.prisma.province.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getActiveCitiesByProvince(provinceId: number) {
    const province = await this.prisma.province.findFirst({
      where: { id: provinceId, isActive: true },
      select: { id: true },
    });

    if (!province) {
      throw new NotFoundException('استان مورد نظر یافت نشد');
    }

    return this.prisma.city.findMany({
      where: { provinceId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        provinceId: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminGetProvinces() {
    return this.prisma.province.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        _count: {
          select: { cities: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminGetCitiesByProvince(provinceId: number) {
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      select: { id: true },
    });

    if (!province) {
      throw new NotFoundException('استان مورد نظر یافت نشد');
    }

    return this.prisma.city.findMany({
      where: { provinceId },
      select: {
        id: true,
        name: true,
        slug: true,
        provinceId: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminUpdateProvinceStatus(id: number, isActive: boolean) {
    const existing = await this.prisma.province.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('استان مورد نظر یافت نشد');
    }

    return this.prisma.province.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
    });
  }

  async adminUpdateCityStatus(id: number, isActive: boolean) {
    const existing = await this.prisma.city.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('شهر مورد نظر یافت نشد');
    }

    return this.prisma.city.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        slug: true,
        provinceId: true,
        isActive: true,
      },
    });
  }
}
