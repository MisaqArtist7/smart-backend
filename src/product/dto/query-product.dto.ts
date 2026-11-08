import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

export class QueryProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید یک عدد صحیح باشد' })
  @Min(1, { message: 'شماره صفحه باید حداقل ۱ باشد' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد در هر صفحه باید یک عدد صحیح باشد' })
  @Min(1, { message: 'تعداد در هر صفحه باید حداقل ۱ باشد' })
  @Max(50, { message: 'حداکثر تعداد در هر صفحه ۵۰ عدد است' })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شناسه دسته باید یک عدد صحیح باشد' })
  categoryId?: number;

  @IsOptional()
  @IsString({ message: 'عبارت جستجو باید متنی باشد' })
  @MaxLength(100, { message: 'حداکثر طول عبارت جستجو ۱۰۰ کاراکتر است' })
  search?: string;

  @IsOptional()
  @IsEnum(ProductSort, {
    message: 'مرتب‌سازی باید یکی از مقادیر newest، price_asc یا price_desc باشد',
  })
  sort?: ProductSort;
}

