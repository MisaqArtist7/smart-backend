import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const categoryInclude = {
  parent: { select: { id: true, name: true } },
};

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    await this.assertSlugFree(dto.slug);
    if (dto.parentId != null) await this.assertParentExists(dto.parentId);
    return this.prisma.category.create({ data: dto, include: categoryInclude });
  }

  findAll(includeInactive = false) {
    return this.prisma.category.findMany({
      where: includeInactive
        ? undefined
        : {
            isActive: true,
            OR: [{ parentId: null }, { parent: { isActive: true } }],
          },
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number, includeInactive = false) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: categoryInclude,
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.slug && dto.slug !== category.slug) {
      await this.assertSlugFree(dto.slug);
    }
    if (dto.parentId != null) {
      await this.assertParentValid(id, dto.parentId);
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
      include: categoryInclude,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);
    if (children > 0 || products > 0) {
      throw new ConflictException(
        'This category has subcategories or products. Move or delete them first.',
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Category deleted' };
  }

  private async assertSlugFree(slug: string) {
    const exists = await this.prisma.category.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('This slug is already used');
  }

  private async assertParentExists(parentId: number) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new BadRequestException('Parent category not found');
  }

  // والد باید وجود داشته باشه و نباید خود دسته یا یکی از نوه‌هاش باشه
  private async assertParentValid(id: number, parentId: number) {
    if (parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    let currentId: number | null = parentId;
    while (currentId !== null) {
      if (currentId === id) {
        throw new BadRequestException(
          'A category cannot be moved under its own subcategory',
        );
      }
      const node: { parentId: number | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      if (!node) throw new BadRequestException('Parent category not found');
      currentId = node.parentId;
    }
  }
}
