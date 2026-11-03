import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be lowercase English letters, numbers, and hyphens',
    })
    @MaxLength(120)
    slug: string;

    @IsOptional()
    @IsInt()
    parentId?: number;

    @IsOptional()
    @IsString()
    description: string;

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
    metaTitle: string;

    @IsOptional()
    @IsString()
    @MaxLength(170)
    metaDescription: string;

    @IsOptional()
    @IsInt()
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}