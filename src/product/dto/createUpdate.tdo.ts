import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './createProduct.tdo.js';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
