import type { CookieOptions, Request, Response } from 'express';
import { ErrorCode } from '@marketpilot/contracts';
import { DomainError } from '@/common';
import type { RequestMeta } from './auth.types';
import type { IssuedRefresh } from './refresh-session.service';

export const REFRESH_COOKIE = 'mp_refresh';

function cookieOptions(secure: boolean): CookieOptions {
  // Scoped to the auth routes so the token is never sent with other API calls.
  // Lax blocks cross-site POSTs; the Origin check below covers the rest.
  return { httpOnly: true, sameSite: 'lax', secure, path: '/v1/auth' };
}

export function setRefreshCookie(response: Response, refresh: IssuedRefresh, secure: boolean): void {
  response.cookie(REFRESH_COOKIE, refresh.token, { ...cookieOptions(secure), expires: refresh.expiresAt });
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE, cookieOptions(secure));
}

export function readRefreshCookie(request: Request): string | undefined {
  const value: unknown = (request.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export function requestMeta(request: Request): RequestMeta {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.headers['user-agent']?.slice(0, 255) ?? null,
  };
}

// Cookie-authenticated endpoints accept requests only from our own web origin.
export function assertTrustedOrigin(request: Request, webOrigin: string): void {
  if (request.headers.origin !== webOrigin) {
    throw new DomainError(ErrorCode.Forbidden, 'Request origin is not allowed', 403);
  }
}
