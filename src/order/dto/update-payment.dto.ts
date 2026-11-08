import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePaymentDto {
  @IsIn(['approve', 'reject'], {
    message: 'عملیات پرداخت باید approve یا reject باشد',
  })
  @IsNotEmpty({ message: 'عملیات پرداخت الزامی است' })
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString({ message: 'یادداشت ادمین باید متنی باشد' })
  @MaxLength(500, { message: 'حداکثر طول یادداشت ادمین ۵۰۰ کاراکتر است' })
  adminNote?: string;
}

