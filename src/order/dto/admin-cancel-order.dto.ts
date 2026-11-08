import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminCancelOrderDto {
  @IsOptional()
  @IsString({ message: 'یادداشت ادمین باید متنی باشد' })
  @MaxLength(500, { message: 'حداکثر طول یادداشت ادمین ۵۰۰ کاراکتر است' })
  adminNote?: string;
}

