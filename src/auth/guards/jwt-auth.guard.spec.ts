import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard (Step 1)', () => {
  let guard: JwtAuthGuard;
  let jwtService: any;
  let prisma: any;
  let reflector: any;

  beforeEach(() => {
    jwtService = {
      verifyAsync: vi.fn(),
    };
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
    };
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };
    guard = new JwtAuthGuard(jwtService, prisma, reflector);
  });

  function createMockContext(cookies: any = {}, headers: any = {}) {
    const request: any = {
      cookies,
      headers,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('1. بدون توکن باید UnauthorizedException (401) صادر کند', async () => {
    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('2. با توکن نامعتبر یا منقضی شده باید 401 صادر کند', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
    const context = createMockContext({ accessToken: 'bad-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('3. اگر توکن معتبر بود ولی کاربر در دیتابیس نبود باید 401 صادر کند', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 1 });
    prisma.user.findUnique.mockResolvedValue(null);
    const context = createMockContext({ accessToken: 'valid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('4. اگر کاربر غیرفعال بود (isActive: false) باید 401 صادر کند', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'تست',
      phone: '09120000000',
      role: 'CUSTOMER',
      isActive: false,
    });
    const context = createMockContext({ accessToken: 'valid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'حساب کاربری شما غیرفعال شده است',
    );
  });

  it('5. با توکن و کاربر فعال باید درخواست را تایید کرده و کاربر را روی request بگذارد', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 1 });
    const user = {
      id: 1,
      name: 'کاربر تست',
      phone: '09120000000',
      role: 'CUSTOMER',
      isActive: true,
    };
    prisma.user.findUnique.mockResolvedValue(user);

    const context = createMockContext({ accessToken: 'valid-token' });
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual(user);
  });

  it('6. اگر مسیر @Public() باشد، باید بدون نیاز به توکن اجازه عبور دهد', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext(); // بدون هیچ کوکی یا توکنی
    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
  });
});
