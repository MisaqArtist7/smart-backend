import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { create } from 'domain';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  @create()
  async create(data: { name: string; description: string }) {
    return this.prisma.category.create({
      data,
    });
  }
}
