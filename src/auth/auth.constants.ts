import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // ۱۵ دقیقه
export const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

export function getAccessTokenCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  };
}

export function getRefreshTokenCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getAccessTokenCookieOptions());
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    getRefreshTokenCookieOptions(),
  );
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
  });
}
