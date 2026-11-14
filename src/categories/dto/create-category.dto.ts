import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
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
  @IsInt()
  parentId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  imageAlt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  metaDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
