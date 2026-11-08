import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ProductService } from './product.service.js';
import { CreateProductDto } from './dto/createProduct.tdo.js';
import { UpdateProductDto } from './dto/createUpdate.tdo.js';
import { QueryProductDto } from './dto/query-product.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';

@Roles(Role.ADMIN)
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  createProduct(@Body() data: CreateProductDto) {
    return this.productService.createProduct(data);
  }

  @Public()
  @Get()
  getAllProducts(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query?: QueryProductDto,
  ) {
    // مسیر عمومی محصولات: در صورت عدم ارسال پارامتر لیست تخت، و در صورت ارسال پارامتر صفحه‌بندی برمی‌گرداند
    return this.productService.getPublicProducts(query);
  }

  @Public()
  @Get('slug/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    // اگر محصول یا دسته‌اش غیرفعال باشد، خطای 404 صادر می‌شود
    return this.productService.getProductBySlug(slug, false);
  }

  @Public()
  @Get(':id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    // اگر محصول یا دسته‌اش غیرفعال باشد، خطای 404 صادر می‌شود
    return this.productService.getProduct(id, false);
  }

  @Patch(':id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductDto,
  ) {
    return this.productService.updateProduct(id, data);
  }

  @Delete(':id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productService.deleteProduct(id);
  }
}
