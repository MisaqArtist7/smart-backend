import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

describe('RolesGuard (Step 4)', () => {
  let guard: RolesGuard;
  let reflector: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: any) {
    const request: any = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('1. اگر روت به نقشی نیاز نداشته باشد، دسترسی تایید می‌شود', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return undefined;
      return undefined;
    });
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('2. اگر روت نیاز به ADMIN داشت و کاربر CUSTOMER بود باید 403 صادر کند', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return ['ADMIN'];
      return undefined;
    });
    const context = createMockContext({ id: 1, role: 'CUSTOMER' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('3. اگر روت نیاز به ADMIN داشت و کاربر ADMIN بود دسترسی تایید می‌شود', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return ['ADMIN'];
      return undefined;
    });
    const context = createMockContext({ id: 1, role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('4. اگر کاربر اصلاً در ریکوئست نبود باید 403 صادر کند', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return ['ADMIN'];
      return undefined;
    });
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('5. اگر روت @Public() باشد، RolesGuard باید بدون نیاز به نقش اجازه عبور دهد', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      if (key === ROLES_KEY) return ['ADMIN'];
      return undefined;
    });
    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});
