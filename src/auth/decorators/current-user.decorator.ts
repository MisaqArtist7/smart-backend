import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';

export interface CurrentUserData {
  id: number;
  name: string;
  phone: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserData | undefined,
    ctx: ExecutionContext,
  ): CurrentUserData | CurrentUserData[keyof CurrentUserData] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData | undefined;

    // اگر user روی request نباشد، یعنی مسیر گارد ندارد که یک خطای برنامه‌نویسی است
    if (!user) {
      throw new InternalServerErrorException(
        'دکوریتور CurrentUser باید فقط در مسیرهای دارای گارد احراز هویت استفاده شود',
      );
    }

    return data ? user[data] : user;
  },
);
