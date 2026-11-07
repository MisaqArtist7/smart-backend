import { describe, it, expect } from 'vitest';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { InternalServerErrorException } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from './current-user.decorator.js';

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

  const mockUser: CurrentUserData = {
    id: 1,
    name: 'تست',
    phone: '09120000000',
    role: 'CUSTOMER',
  };

  it('1. با ورود معتبر باید کل اطلاعات مجاز کاربر (id, name, phone, role) را برگرداند', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    };

    const result = factory(undefined, mockContext);
    expect(result).toEqual(mockUser);
  });

  it('2. اگر کلید خاصی مثل @CurrentUser("id") داده شود، فقط همان فیلد را برمی‌گرداند', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    };

    const result = factory('id', mockContext);
    expect(result).toBe(1);
  });

  it('3. اگر اسم فیلد "phone" داده شود، فقط شماره تلفن را برمی‌گرداند', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    };

    const result = factory('phone', mockContext);
    expect(result).toBe('09120000000');
  });

  it('4. اگر request.user وجود نداشته باشد (نبود گارد)، باید خطای خطای برنامه‌نویسی (500) بدهد', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: undefined }),
      }),
    };

    expect(() => factory(undefined, mockContext)).toThrow(
      InternalServerErrorException,
    );
  });
});
