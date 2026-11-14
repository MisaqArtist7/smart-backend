import { Module } from '@nestjs/common';
import { BrandService } from './brand.service.js';
import { BrandController } from './brand.controller.js';
import { AdminBrandController } from './admin-brands.controller.js';

@Module({
  controllers: [BrandController, AdminBrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
