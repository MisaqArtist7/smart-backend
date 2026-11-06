import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/createProduct.tdo.js';
import { UpdateProductDto } from './dto/createUpdate.tdo.js';

@Injectable()
export class ProductService {
    constructor(private readonly prisma: PrismaService) {}

    getAllProducts() {
        return this.prisma.product.findMany({
        include: { images: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { id: 'desc' },
        });
    }

    async getProduct(id: number) {
        const product = await this.prisma.product.findUnique({
        where: { id },
        include: { images: { orderBy: { sortOrder: 'asc' } }, category: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    async createProduct(data: CreateProductDto) {
        if (data.discountPrice !== undefined && data.discountPrice >= data.price) {
            throw new BadRequestException('Discount price must be less than price');
        }
        await this.assertSlugFree(data.slug);
        await this.assertCategoryExists(data.categoryId);
        return this.prisma.product.create({ data });
    }

    async updateProduct(id: number, data: UpdateProductDto) {
        const product = await this.getProduct(id);

        if (data.slug && data.slug !== product.slug) {
        await this.assertSlugFree(data.slug);
        }
        if (data.categoryId !== undefined) {
        await this.assertCategoryExists(data.categoryId);
        }

        return this.prisma.product.update({ where: { id }, data });
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

    private async assertSlugFree(slug: string) {
        const exists = await this.prisma.product.findUnique({ where: { slug } });
        if (exists) throw new ConflictException('This slug is already used');
    }

    private async assertCategoryExists(categoryId: number) {
        const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
        if (!category) throw new BadRequestException('Category not found');
    }

    private async assertSkuFree(sku?: string, exceptId?: number) {
        if (!sku) return;
        const exists = await this.prisma.product.findUnique({ where: { sku } });
        if (exists && exists.id !== exceptId) {
            throw new ConflictException('This SKU is already used');
        }
        }
}