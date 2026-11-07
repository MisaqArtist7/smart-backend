import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProductService } from './product.service.js';
import { CreateProductDto } from './dto/createProduct.tdo.js';
import { UpdateProductDto } from './dto/createUpdate.tdo.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  createProduct(@Body() data: CreateProductDto) {
    return this.productService.createProduct(data);
  }

  @Public()
  @Get()
  getAllProducts() {
    return this.productService.getAllProducts();
  }

  @Public()
  @Get(':id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getProduct(id);
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
