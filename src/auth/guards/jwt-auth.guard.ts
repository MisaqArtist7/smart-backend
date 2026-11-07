import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // اگر مسیر به صورت عمومی (@Public) علامت‌گذاری شده بود، عبور کند
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('لطفاً وارد حساب کاربری خود شوید');
    }

    let payload: { sub: number; phone?: string; role?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('کاربری با این مشخصات یافت نشد');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('حساب کاربری شما غیرفعال شده است');
    }

    // قرار دادن کاربر روی request
    (request as Request & { user: typeof user }).user = user;

    return true;
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // ابتدا از کوکی خوانده می‌شود
    if (request.cookies?.[ACCESS_TOKEN_COOKIE]) {
      return request.cookies[ACCESS_TOKEN_COOKIE];
    }

    // پشتیبانی از هدر Authorization در صورت ارسال به صورت Bearer
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }
}

export { JwtAuthGuard as AuthGuard };

