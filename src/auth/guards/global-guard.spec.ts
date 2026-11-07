import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('Step 3: Global Guard & @Public()', () => {
  let guard: JwtAuthGuard;
  let jwtService: any;
  let prisma: any;
  let reflector: Reflector;

  beforeEach(() => {
    jwtService = {
      verifyAsync: vi.fn(),
    };
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
    };
    reflector = new Reflector();
    guard = new JwtAuthGuard(jwtService, prisma, reflector);
  });

  function createMockContext(
    handler: any,
    classRef: any = class TestController {},
    cookies: any = {},
  ) {
    const request: any = {
      cookies,
      headers: {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler,
      getClass: () => classRef,
    } as unknown as ExecutionContext;
  }

  it('1. مسیر با دکوریتور @Public() روی متد باید بدون توکن اجازه عبور داشته باشد', async () => {
    function publicHandler() {}
    Reflect.defineMetadata('isPublic', true, publicHandler);

    const context = createMockContext(publicHandler);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('2. مسیر با دکوریتور @Public() روی کل کنترلر (Class) باید بدون توکن اجازه عبور داشته باشد', async () => {
    class PublicController {}
    Reflect.defineMetadata('isPublic', true, PublicController);
    function someHandler() {}

    const context = createMockContext(someHandler, PublicController);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('3. یک مسیر جدیدِ فراموش‌شده (بدون @Public) به صورت پیش‌فرض قفل است و بدون ورود 401 می‌دهد', async () => {
    function unannotatedHandler() {}

    const context = createMockContext(unannotatedHandler);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('4. مسیر قفل‌شده (مثل POST /product یا GET /auth/me) با توکن معتبر اجازه ورود پیدا می‌کند', async () => {
    function protectedHandler() {}
    jwtService.verifyAsync.mockResolvedValue({ sub: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      name: 'کاربر تست',
      phone: '09120000000',
      role: 'CUSTOMER',
      isActive: true,
    });

    const context = createMockContext(
      protectedHandler,
      class TestController {},
      {
        accessToken: 'valid-jwt-token',
      },
    );

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({
      id: 1,
      name: 'کاربر تست',
      phone: '09120000000',
      role: 'CUSTOMER',
    });
  });
});
