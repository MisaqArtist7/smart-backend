import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminCancelOrderDto {
  @IsOptional()
  @IsString({ message: 'یادداشت ادمین باید متنی باشد' })
  @MaxLength(1000, { message: 'حداکثر طول یادداشت ادمین ۱۰۰۰ کاراکتر است' })
  adminNote?: string;
}

