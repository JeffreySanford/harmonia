import {
  UnauthorizedException,
} from '@nestjs/common';
import {
  REFRESH_TOKEN_SECONDS,
} from './auth-token.config';

export const REFRESH_COOKIE_NAME =
  'harmonia_refresh';

const REFRESH_COOKIE_PATH =
  '/api/auth';

export interface RefreshCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
}

export interface RefreshCookieClearOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: string;
}

export interface RefreshCookieResponse {
  cookie(
    name: string,
    value: string,
    options:
      RefreshCookieOptions
  ): void;

  clearCookie(
    name: string,
    options:
      RefreshCookieClearOptions
  ): void;
}

function secureCookies():
  boolean {
  return (
    process.env.NODE_ENV ===
    'production'
  );
}

export function extractRefreshCookieFromHeader(
  cookieHeader:
    string | undefined
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (
    const fragment
    of cookieHeader.split(';')
  ) {
    const separator =
      fragment.indexOf('=');

    if (separator < 0) {
      continue;
    }

    const name =
      fragment
        .slice(
          0,
          separator
        )
        .trim();

    if (
      name !==
      REFRESH_COOKIE_NAME
    ) {
      continue;
    }

    const value =
      fragment
        .slice(
          separator + 1
        )
        .trim();

    if (!value) {
      return null;
    }

    try {
      return decodeURIComponent(
        value
      );
    } catch {
      return null;
    }
  }

  return null;
}

export function requireRefreshCookie(
  cookieHeader:
    string | undefined
): string {
  const token =
    extractRefreshCookieFromHeader(
      cookieHeader
    );

  if (!token) {
    throw new UnauthorizedException(
      'Refresh session required'
    );
  }

  return token;
}

export function setRefreshCookie(
  response:
    RefreshCookieResponse,
  refreshToken:
    string
): void {
  response.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    {
      httpOnly:
        true,
      secure:
        secureCookies(),
      sameSite:
        'strict',
      path:
        REFRESH_COOKIE_PATH,
      maxAge:
        REFRESH_TOKEN_SECONDS *
        1000,
    }
  );
}

export function clearRefreshCookie(
  response:
    RefreshCookieResponse
): void {
  response.clearCookie(
    REFRESH_COOKIE_NAME,
    {
      httpOnly:
        true,
      secure:
        secureCookies(),
      sameSite:
        'strict',
      path:
        REFRESH_COOKIE_PATH,
    }
  );
}
