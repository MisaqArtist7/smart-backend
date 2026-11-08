import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client.js';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'وضعیت جدید سفارش نامعتبر است' })
  @IsNotEmpty({ message: 'وضعیت جدید سفارش الزامی است' })
  status: OrderStatus;

  @IsOptional()
  @IsString({ message: 'کد رهگیری پستی باید متنی باشد' })
  @MaxLength(50, { message: 'حداکثر طول کد رهگیری ۵۰ کاراکتر است' })
  trackingCode?: string;

  @IsOptional()
  @IsString({ message: 'یادداشت ادمین باید متنی باشد' })
  @MaxLength(1000, { message: 'حداکثر طول یادداشت ادمین ۱۰۰۰ کاراکتر است' })
  adminNote?: string;
}

