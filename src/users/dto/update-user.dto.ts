import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/client.js';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'نام باید حداقل ۲ کاراکتر باشد' })
  @MaxLength(100, { message: 'نام نباید بیشتر از ۱۰۰ کاراکتر باشد' })
  name?: string;

  @IsOptional()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود' })
  phone?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'نقش کاربری باید ADMIN یا CUSTOMER باشد' })
  role?: Role;

  @IsOptional()
  @IsBoolean({ message: 'وضعیت فعال بودن باید بولیین باشد' })
  isActive?: boolean;
}

export class UpdateUserRoleDto {
  @IsEnum(Role, { message: 'نقش کاربری باید ADMIN یا CUSTOMER باشد' })
  role: Role;
}
