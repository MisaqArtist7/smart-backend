import { Module } from '@nestjs/common';
import { CategoryService } from './categories.service.js';
import { CategoryController } from './categories.controller.js';
import { AdminCategoryController } from './admin-categories.controller.js';

@Module({
  controllers: [CategoryController, AdminCategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
