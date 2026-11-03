import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async create(data : CreateCategoryDto) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (existingCategory) {
      throw new ForbiddenException('Category with this slug already exists');
    }

    return this.prisma.category.create({
      data,
    });

  }
  
  async remove(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new ForbiddenException('Category not found');
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }
}
