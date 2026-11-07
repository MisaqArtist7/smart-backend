import { Module } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ProductController } from './product.controller.js';
import { AdminProductController } from './admin-product.controller.js';

@Module({
  controllers: [ProductController, AdminProductController],
  providers: [ProductService],
})
export class ProductModule {}
