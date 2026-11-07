import { describe, it, expect } from 'vitest';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { CurrentUser } from './current-user.decorator.js';

describe('CurrentUser Decorator (Step 2)', () => {
  function getParamDecoratorFactory(decorator: any) {
    class Test {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      test(@decorator() user: any) {}
    }
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
    const key = Object.keys(metadata)[0];
    return metadata[key].factory;
  }

  it('1. باید کل آبجکت کاربر را از request.user برگرداند', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockUser = { id: 1, name: 'تست', phone: '09120000000', role: 'CUSTOMER' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    };

    const result = factory(undefined, mockContext);
    expect(result).toEqual(mockUser);
  });

  it('2. در صورت ارسال کلید مشخص، فقط همان فیلد را برگرداند', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockUser = { id: 1, name: 'تست', phone: '09120000000', role: 'CUSTOMER' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    };

    const result = factory('id', mockContext);
    expect(result).toBe(1);
  });
});
