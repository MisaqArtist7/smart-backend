import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'نام باید از نوع متنی باشد' })
  @IsNotEmpty({ message: 'وارد کردن نام الزامی است' })
  @Length(2, 100, { message: 'نام باید بین ۲ تا ۱۰۰ کاراکتر باشد' })
  name: string;

  @IsString({ message: 'شماره تلفن باید از نوع متنی باشد' })
  @IsNotEmpty({ message: 'وارد کردن شماره تلفن الزامی است' })
  @Matches(/^09\d{9}$/, {
    message:
      'شماره تلفن باید یک شماره موبایل معتبر ۱۱ رقمی باشد (مثال: 09123456789)',
  })
  phone: string;
}

export class LoginDto {
  @IsString({ message: 'شماره تلفن باید از نوع متنی باشد' })
  @IsNotEmpty({ message: 'وارد کردن شماره تلفن الزامی است' })
  @Matches(/^09\d{9}$/, {
    message:
      'شماره تلفن باید یک شماره موبایل معتبر ۱۱ رقمی باشد (مثال: 09123456789)',
  })
  phone: string;
}

export class RequestOtpDto {
  @IsString({ message: 'شماره تلفن باید از نوع متنی باشد' })
  @IsNotEmpty({ message: 'وارد کردن شماره تلفن الزامی است' })
  @Matches(/^09\d{9}$/, {
    message:
      'شماره تلفن باید یک شماره موبایل معتبر ۱۱ رقمی باشد (مثال: 09123456789)',
  })
  phone: string;
}

export class VerifyOtpDto {
  @IsString({ message: 'شماره تلفن باید از نوع متنی باشد' })
  @IsNotEmpty({ message: 'وارد کردن شماره تلفن الزامی است' })
  @Matches(/^09\d{9}$/, {
    message:
      'شماره تلفن باید یک شماره موبایل معتبر ۱۱ رقمی باشد (مثال: 09123456789)',
  })
  phone: string;

  @IsString({ message: 'کد تایید باید از نوع متنی باشد' })
  @IsNotEmpty({ message: 'وارد کردن کد تایید الزامی است' })
  @Matches(/^\d{6}$/, { message: 'کد تایید باید دقیقاً ۶ رقم عددی باشد' })
  code: string;
}

// برای سازگاری احتمالی کدهای قبلی
export { RegisterDto as AuthDto, RegisterDto as AuthDtoTs };
