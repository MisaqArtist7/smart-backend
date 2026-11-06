import {
BadRequestException,
ConflictException,
Injectable,
NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/createProduct.tdo.js';
import { UpdateProductDto } from './dto/createUpdate.tdo.js';

const productInclude = {
images: { orderBy: { sortOrder: 'asc' as const } },
category: { select: { id: true, name: true } },
};

@Injectable()
export class ProductService {
constructor(private readonly prisma: PrismaService) {}

getAllProducts() {
    return this.prisma.product.findMany({
    include: productInclude,
    orderBy: { id: 'desc' },
    });
}

async getProduct(id: number) {
    const product = await this.prisma.product.findUnique({
    where: { id },
    include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
}

async createProduct(data: CreateProductDto) {
    this.assertDiscountValid(data.price, data.discountPrice);
    await this.assertSlugFree(data.slug);
    await this.assertSkuFree(data.sku);
    await this.assertCategoryExists(data.categoryId);
    return this.prisma.product.create({ data, include: productInclude });
}

async updateProduct(id: number, data: UpdateProductDto) {
    const product = await this.getProduct(id);

    const finalPrice = data.price ?? product.price;
    const finalDiscount =
    data.discountPrice === undefined ? product.discountPrice : data.discountPrice;
    this.assertDiscountValid(finalPrice, finalDiscount);

    if (data.slug && data.slug !== product.slug) {
    await this.assertSlugFree(data.slug);
    }
    if (data.sku && data.sku !== product.sku) {
    await this.assertSkuFree(data.sku, id);
    }
    if (data.categoryId !== undefined) {
    await this.assertCategoryExists(data.categoryId);
    }

    return this.prisma.product.update({
    where: { id },
    data,
    include: productInclude,
    });
}

async deleteProduct(id: number) {
    await this.getProduct(id);

    const ordered = await this.prisma.orderItem.count({ where: { productId: id } });
    if (ordered > 0) {
    throw new ConflictException(
        'This product exists in past orders and cannot be deleted. Set isActive to false instead.',
    );
    }

    await this.prisma.product.delete({ where: { id } });
    return { message: 'Product deleted' };
}

private assertDiscountValid(price: number, discountPrice?: number | null) {
    if (discountPrice != null && discountPrice >= price) {
    throw new BadRequestException('Discount price must be less than price');
    }
}

private async assertSlugFree(slug: string) {
    const exists = await this.prisma.product.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('This slug is already used');
}

private async assertSkuFree(sku?: string, exceptId?: number) {
    if (!sku) return;
    const exists = await this.prisma.product.findUnique({ where: { sku } });
    if (exists && exists.id !== exceptId) {
    throw new ConflictException('This SKU is already used');
    }
}

private async assertCategoryExists(categoryId: number) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException('Category not found');
}
}