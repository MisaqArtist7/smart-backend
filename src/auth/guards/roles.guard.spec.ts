import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';

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
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('2. اگر روت نیاز به ADMIN داشت و کاربر CUSTOMER بود باید 403 صادر کند', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ id: 1, role: 'CUSTOMER' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('3. اگر روت نیاز به ADMIN داشت و کاربر ADMIN بود دسترسی تایید می‌شود', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ id: 1, role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('4. اگر کاربر اصلاً در ریکوئست نبود باید 403 صادر کند', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
