import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContactSubject } from '../../generated/prisma/client.js';

export class CreateContactDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^09\d{9}$/, {
    message: 'Phone number must be a valid 11-digit Iranian mobile number starting with 09',
  })
  phone: string;

  @IsEnum(ContactSubject, {
    message:
      'Subject must be one of: ORDER_ISSUE, PAYMENT_ISSUE, PRODUCT_QUESTION, DELIVERY_ISSUE, OTHER',
  })
  @IsNotEmpty({ message: 'Subject is required' })
  subject: ContactSubject;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Message must be a string' })
  @IsNotEmpty({ message: 'Message is required' })
  @MinLength(10, { message: 'Message must be at least 10 characters' })
  @MaxLength(2000, { message: 'Message must not exceed 2000 characters' })
  message: string;

  /**
   * Honeypot field for bot detection.
   * Real users leave this empty. If non-empty, the request succeeds silently without saving.
   */
  @IsOptional()
  @IsString({ message: 'Website must be a string' })
  website?: string;
}

