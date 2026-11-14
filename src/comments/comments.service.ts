import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { CommentStatus } from '../generated/prisma/client.js';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findProductComments(productId: number) {
    return this.prisma.comment.findMany({
      where: {
        productId,
        status: CommentStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createComment(productId: number, userId: number, dto: CreateCommentDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID '${productId}' not found`);
    }

    // بررسی اینکه آیا کاربر قبلاً این محصول را در سفارشی با پرداخت موفق خریده است
    const boughtCount = await this.prisma.orderItem.count({
      where: {
        productId,
        order: {
          userId,
          paymentStatus: 'PAID',
        },
      },
    });

    return this.prisma.comment.create({
      data: {
        productId,
        userId,
        title: dto.title?.trim() || null,
        text: dto.text.trim(),
        rating: dto.rating ?? 5,
        isRecommended: dto.isRecommended ?? null,
        isBuyer: boughtCount > 0,
        status: CommentStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async adminFindAll(query: {
    page?: number;
    limit?: number;
    status?: CommentStatus;
    productId?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = Number(query.productId);

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(id: number, status: CommentStatus) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID '${id}' not found`);
    }

    return this.prisma.comment.update({
      where: { id },
      data: { status },
    });
  }

  async replyComment(id: number, replyText: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID '${id}' not found`);
    }

    const cleanReply = replyText?.trim();
    if (!cleanReply) {
      throw new BadRequestException('پاسخ نمی‌تواند خالی باشد');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        adminReply: cleanReply,
        adminReplyAt: new Date(),
      },
    });
  }

  async remove(id: number) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException(`Comment with ID '${id}' not found`);
    }

    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Comment deleted' };
  }
}

