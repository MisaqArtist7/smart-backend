import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';

@Roles(Role.ADMIN)
@Controller(['admin/product', 'admin/products'])
export class AdminProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  getAllProducts() {
    // پنل ادمین تمام محصولات (شامل غیرفعال‌ها) را مشاهده می‌کند
    return this.productService.getAllProducts(true);
  }

  @Get(':id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    // مشاهده جزئیات محصول حتی اگر غیرفعال باشد
    return this.productService.getProduct(id, true);
  }
}
