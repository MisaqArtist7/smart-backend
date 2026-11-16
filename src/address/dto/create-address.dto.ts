import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import {
  NO_CONTROL_CHARS_REGEX,
  normalizePhoneInput,
  normalizePostalCodeInput,
  POSTAL_CODE_REGEX,
  PRIMARY_PHONE_REGEX,
  SECONDARY_PHONE_REGEX,
  trimOptionalText,
  trimRequiredText,
} from '../address.utils.js';

export class CreateAddressDto {
  @Transform(({ value }) => trimRequiredText(value))
  @IsString({ message: 'عنوان آدرس باید متنی باشد' })
  @IsNotEmpty({ message: 'عنوان آدرس الزامی است' })
  @Length(2, 50, { message: 'عنوان آدرس باید بین ۲ تا ۵۰ کاراکتر باشد' })
  @Matches(NO_CONTROL_CHARS_REGEX, {
    message: 'عنوان آدرس شامل کاراکترهای غیرمجاز است',
  })
  title: string;

  @Transform(({ value }) => trimRequiredText(value))
  @IsString({ message: 'نام تحویل‌گیرنده باید متنی باشد' })
  @IsNotEmpty({ message: 'نام تحویل‌گیرنده الزامی است' })
  @Length(2, 100, {
    message: 'نام تحویل‌گیرنده باید بین ۲ تا ۱۰۰ کاراکتر باشد',
  })
  @Matches(NO_CONTROL_CHARS_REGEX, {
    message: 'نام تحویل‌گیرنده شامل کاراکترهای غیرمجاز است',
  })
  receiverName: string;

  @Transform(({ value }) => normalizePhoneInput(value, false))
  @IsString({ message: 'شماره تماس اصلی باید متنی باشد' })
  @IsNotEmpty({ message: 'شماره تماس اصلی الزامی است' })
  @Matches(PRIMARY_PHONE_REGEX, {
    message: 'شماره تماس اصلی باید شماره موبایل معتبر ایران باشد (مثال: 09123456789)',
  })
  receiverPhone: string;

  @Transform(({ value }) => normalizePhoneInput(value, true))
  @IsOptional()
  @IsString({ message: 'شماره تماس دوم باید متنی باشد' })
  @Matches(SECONDARY_PHONE_REGEX, {
    message:
      'شماره تماس دوم باید شماره موبایل (09xxxxxxxxx) یا تلفن ثابت ۱۱ رقمی با کد شهر (مثال: 02188776655) باشد',
  })
  secondaryPhone?: string;

  @IsInt({ message: 'شناسه استان باید عدد صحیح باشد' })
  @Min(1, { message: 'شناسه استان نامعتبر است' })
  provinceId: number;

  @IsInt({ message: 'شناسه شهر باید عدد صحیح باشد' })
  @Min(1, { message: 'شناسه شهر نامعتبر است' })
  cityId: number;

  @Transform(({ value }) => trimRequiredText(value))
  @IsString({ message: 'نشانی خیابان باید متنی باشد' })
  @IsNotEmpty({ message: 'نشانی خیابان و کوچه الزامی است' })
  @Length(5, 300, {
    message: 'نشانی خیابان باید بین ۵ تا ۳۰۰ کاراکتر باشد',
  })
  @Matches(NO_CONTROL_CHARS_REGEX, {
    message: 'نشانی خیابان شامل کاراکترهای غیرمجاز است',
  })
  streetAddress: string;

  @Transform(({ value }) => trimRequiredText(value))
  @IsString({ message: 'پلاک باید متنی باشد' })
  @IsNotEmpty({ message: 'پلاک الزامی است' })
  @Length(1, 20, { message: 'پلاک باید بین ۱ تا ۲۰ کاراکتر باشد' })
  @Matches(NO_CONTROL_CHARS_REGEX, {
    message: 'پلاک شامل کاراکترهای غیرمجاز است',
  })
  plaque: string;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString({ message: 'واحد باید متنی باشد' })
  @Length(1, 20, { message: 'واحد باید بین ۱ تا ۲۰ کاراکتر باشد' })
  @Matches(NO_CONTROL_CHARS_REGEX, {
    message: 'واحد شامل کاراکترهای غیرمجاز است',
  })
  unit?: string;

  @Transform(({ value }) => trimOptionalText(value))
  @IsOptional()
  @IsString({ message: 'طبقه باید متنی باشد' })
  @Length(1, 20, { message: 'طبقه باید بین ۱ تا ۲۰ کاراکتر باشد' })
  @Matches(NO_CONTROL_CHARS_REGEX, {
    message: 'طبقه شامل کاراکترهای غیرمجاز است',
  })
  floor?: string;

  @Transform(({ value }) => normalizePostalCodeInput(value))
  @IsOptional()
  @IsString({ message: 'کد پستی باید متنی باشد' })
  @Matches(POSTAL_CODE_REGEX, {
    message: 'کد پستی باید دقیقاً ۱۰ رقم باشد',
  })
  postalCode?: string;
}
