import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/createProduct.tdo.js';
import { UpdateProductDto } from './dto/createUpdate.tdo.js';
import {
  ProductSort,
  type QueryProductDto,
} from './dto/query-product.dto.js';

const productInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  category: { select: { id: true, name: true } },
};

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  getAllProducts(includeInactive = false) {
    return this.prisma.product.findMany({
      where: includeInactive
        ? undefined
        : {
            isActive: true,
            category: { isActive: true },
          },
      include: productInclude,
      orderBy: { id: 'desc' },
    });
  }

  async getPublicProducts(query?: QueryProductDto) {
    const isPaginated =
      query &&
      (query.page !== undefined ||
        query.limit !== undefined ||
        query.categoryId !== undefined ||
        Boolean(query.search?.trim()) ||
        query.sort !== undefined);

    if (!isPaginated) {
      return this.getAllProducts(false);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      category: { isActive: true },
    };

    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }

    if (query.search?.trim()) {
      where.title = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    let orderBy: any = { createdAt: 'desc' };
    if (query.sort === ProductSort.PRICE_ASC) {
      orderBy = { price: 'asc' };
    } else if (query.sort === ProductSort.PRICE_DESC) {
      orderBy = { price: 'desc' };
    } else if (query.sort === ProductSort.NEWEST) {
      orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getProduct(id: number, includeInactive = false) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        ...(includeInactive
          ? {}
          : {
              isActive: true,
              category: { isActive: true },
            }),
      },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getProductBySlug(slug: string, includeInactive = false) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        ...(includeInactive
          ? {}
          : {
              isActive: true,
              category: { isActive: true },
            }),
      },
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

    const { images, ...productData } = data;
    return this.prisma.product.create({
      data: {
        ...productData,
        ...(images && images.length > 0
          ? {
              images: {
                create: images.map((img, idx) => ({
                  url: img.url,
                  alt: img.alt ?? null,
                  sortOrder: img.sortOrder ?? idx,
                })),
              },
            }
          : {}),
      },
      include: productInclude,
    });
  }

  async updateProduct(id: number, data: UpdateProductDto) {
    const product = await this.getProduct(id, true);

    const finalPrice = data.price ?? product.price;
    const finalDiscount =
      data.discountPrice === undefined
        ? product.discountPrice
        : data.discountPrice;
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

    const { images, ...productData } = data;
    return this.prisma.$transaction(async (tx) => {
      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img, idx) => ({
              productId: id,
              url: img.url,
              alt: img.alt ?? null,
              sortOrder: img.sortOrder ?? idx,
            })),
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: productData,
        include: productInclude,
      });
    });
  }

  async deleteProduct(id: number) {
    await this.getProduct(id, true);

    const ordered = await this.prisma.orderItem.count({
      where: { productId: id },
    });
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
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new BadRequestException('Category not found');
  }
}
