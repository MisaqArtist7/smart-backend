import { Module } from '@nestjs/common';
import { CategoryService } from './categories.service.js';
import { CategoryController } from './categories.controller.js';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
