import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CategoryService } from './categories.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';

@Roles(Role.ADMIN)
@Controller('admin/categories')
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll() {
    // پنل ادمین تمام دسته‌ها (شامل غیرفعال‌ها) را مشاهده می‌کند
    return this.categoryService.findAll(true);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // مشاهده جزئیات دسته حتی اگر غیرفعال باشد
    return this.categoryService.findOne(id, true);
  }
}
