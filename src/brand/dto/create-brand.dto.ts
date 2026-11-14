import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Matches(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, {
    message: 'Slug must contain only letters (English or Persian), numbers, and hyphens',
  })
  @MaxLength(120)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logo?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  metaDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

