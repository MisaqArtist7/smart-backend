import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ACCESS_TOKEN_COOKIE } from '../../auth/auth.constants.js';
import type { CurrentUserData } from '../../auth/decorators/current-user.decorator.js';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        phone?: string;
        role?: string;
      }>(token);

      if (payload?.sub) {
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

        if (user && user.isActive) {
          (request as Request & { user: CurrentUserData }).user = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
          };
        }
      }
    } catch {
      // Ignored: If token is expired, forged or invalid, proceed as anonymous visitor
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    if (request.cookies?.[ACCESS_TOKEN_COOKIE]) {
      return request.cookies[ACCESS_TOKEN_COOKIE];
    }
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return undefined;
  }
}

