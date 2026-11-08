import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsInt({ message: 'شناسه محصول باید یک عدد صحیح باشد' })
  @IsNotEmpty({ message: 'شناسه محصول الزامی است' })
  productId: number;

  @IsInt({ message: 'تعداد کالا باید یک عدد صحیح باشد' })
  @Min(1, { message: 'حداقل تعداد هر قلم کالا ۱ عدد است' })
  @Max(20, { message: 'حداکثر تعداد هر قلم کالا ۲۰ عدد است' })
  quantity: number;
}

export class CreateOrderDto {
  @IsInt({ message: 'شناسه آدرس باید یک عدد صحیح باشد' })
  @IsNotEmpty({ message: 'شناسه آدرس الزامی است' })
  addressId: number;

  @Equals('CARD_TO_CARD', {
    message: 'تنها روش پرداخت مجاز کارت به کارت (CARD_TO_CARD) می‌باشد',
  })
  @IsNotEmpty({ message: 'روش پرداخت الزامی است' })
  paymentMethod: 'CARD_TO_CARD';

  @IsArray({ message: 'اقلام سفارش باید به صورت آرایه باشد' })
  @ArrayMinSize(1, { message: 'سفارش باید حداقل دارای ۱ قلم کالا باشد' })
  @ArrayMaxSize(30, { message: 'حداکثر تعداد اقلام مجاز در هر سفارش ۳۰ قلم است' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString({ message: 'یادداشت سفارش باید متنی باشد' })
  @MaxLength(500, { message: 'حداکثر طول یادداشت سفارش ۵۰۰ کاراکتر است' })
  note?: string;
}

