import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OrderStatus,
  PaymentStatus,
} from '../../generated/prisma/client.js';

export class AdminGetOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'وضعیت سفارش نامعتبر است' })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'وضعیت پرداخت نامعتبر است' })
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString({ message: 'عبارت جستجو باید متنی باشد' })
  @MaxLength(100, { message: 'حداکثر طول عبارت جستجو ۱۰۰ کاراکتر است' })
  search?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'فرمت تاریخ شروع باید ISO8601 باشد' })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'فرمت تاریخ پایان باید ISO8601 باشد' })
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید یک عدد صحیح باشد' })
  @Min(1, { message: 'شماره صفحه باید حداقل ۱ باشد' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد در هر صفحه باید یک عدد صحیح باشد' })
  @Min(1, { message: 'تعداد در هر صفحه باید حداقل ۱ باشد' })
  @Max(50, { message: 'حداکثر تعداد در هر صفحه ۵۰ عدد است' })
  limit: number = 10;
}

