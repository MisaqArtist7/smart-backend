import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateAddressDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title is required' })
  @Length(2, 50, { message: 'Title must be between 2 and 50 characters' })
  title: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Receiver name must be a string' })
  @IsNotEmpty({ message: 'Receiver name is required' })
  @Length(2, 100, {
    message: 'Receiver name must be between 2 and 100 characters',
  })
  receiverName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Receiver phone must be a string' })
  @IsNotEmpty({ message: 'Receiver phone is required' })
  @Matches(/^09\d{9}$/, {
    message:
      'Receiver phone must be a valid Iranian mobile number (e.g. 09123456789)',
  })
  receiverPhone: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Province must be a string' })
  @IsNotEmpty({ message: 'Province is required' })
  @Length(2, 50, { message: 'Province must be between 2 and 50 characters' })
  province: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'City must be a string' })
  @IsNotEmpty({ message: 'City is required' })
  @Length(2, 50, { message: 'City must be between 2 and 50 characters' })
  city: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Address line must be a string' })
  @IsNotEmpty({ message: 'Address line is required' })
  @Length(5, 500, {
    message: 'Address line must be between 5 and 500 characters',
  })
  addressLine: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Postal code must be a string' })
  @IsNotEmpty({ message: 'Postal code is required' })
  @Matches(/^\d{10}$/, { message: 'Postal code must be exactly 10 digits' })
  postalCode: string;
}

