export class CreateCategoryDto {
    name: string;
    slug: string;
    description?: string;
    image?: string;
    metaTitle?: string;
    metaDescription?: string;
    imageAlt?: string;
}
