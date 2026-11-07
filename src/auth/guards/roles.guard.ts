import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/client.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { CurrentUserData } from '../decorators/current-user.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ۱. مسیرهای @Public() بدون نیاز به نقش رد شوند
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ۲. خواندن نقش‌های الزامی از متد یا کنترلر
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // اگر مسیر نقش خاصی نخواسته باشد، هر کاربر احرازهویت‌شده اجازه عبور دارد
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: CurrentUserData }).user;

    // اگر کاربر در request موجود نبود
    if (!user || !user.role) {
      throw new ForbiddenException('دسترسی مجاز نمی‌باشد');
    }

    // ۳. تطابق نقش لودشده از دیتابیس با نقش‌های مجاز
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        'شما دسترسی لازم برای انجام این عملیات را ندارید',
      );
    }

    return true;
  }
}
