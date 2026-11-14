import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { UpdateBrandDto } from './dto/update-brand.dto.js';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.brand.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string, includeInactive = false) {
    let cleanSlug = slug;
    try {
      cleanSlug = decodeURIComponent(slug).trim().toLowerCase();
    } catch {
      cleanSlug = slug.trim().toLowerCase();
    }

    const brand = await this.prisma.brand.findFirst({
      where: {
        slug: cleanSlug,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        products: {
          where: includeInactive ? undefined : { isActive: true },
          include: { images: true, category: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug '${slug}' not found`);
    }

    return brand;
  }

  async findOne(id: number, includeInactive = false) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        products: {
          where: includeInactive ? undefined : { isActive: true },
          include: { images: true, category: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID '${id}' not found`);
    }

    return brand;
  }

  async create(dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Brand with slug '${dto.slug}' already exists`);
    }

    return this.prisma.brand.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        logo: dto.logo?.trim() || null,
        description: dto.description?.trim() || null,
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateBrandDto) {
    await this.findOne(id, true);

    if (dto.slug) {
      const existing = await this.prisma.brand.findUnique({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Brand with slug '${dto.slug}' already exists`);
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim().toLowerCase() } : {}),
        ...(dto.logo !== undefined ? { logo: dto.logo ? dto.logo.trim() : null } : {}),
        ...(dto.description !== undefined ? { description: dto.description ? dto.description.trim() : null } : {}),
        ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle ? dto.metaTitle.trim() : null } : {}),
        ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription ? dto.metaDescription.trim() : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id, true);
    await this.prisma.brand.delete({ where: { id } });
    return { message: 'Brand deleted' };
  }
}

