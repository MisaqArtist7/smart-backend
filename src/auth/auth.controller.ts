import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  LoginDto,
  RegisterDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './auth.constants.js';
import { AuthGuard } from './guards/auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(200)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('request-otp')
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return {
      message: result.message,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const tokens = await this.authService.refresh(rawRefreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'توکن با موفقیت تمدید شد' };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.authService.logout(rawRefreshToken);
    clearAuthCookies(res);
    return result;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(
    @CurrentUser()
    user: {
      id: number;
      name: string;
      phone: string;
      role: string;
    },
  ) {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
  }
}
