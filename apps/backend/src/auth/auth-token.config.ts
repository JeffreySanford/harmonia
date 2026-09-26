import { ConfigService } from '@nestjs/config';

export type AuthUserRole =
  | 'admin'
  | 'user'
  | 'guest';

export type AuthTokenType =
  | 'access'
  | 'refresh';

export interface AuthTokenPayload {
  sub: string;
  username: string;
  role: AuthUserRole;
  typ: AuthTokenType;
}

export interface AuthenticatedRequestUser {
  userId: string;
  username: string;
  email: string;
  role: AuthUserRole;
}

export interface AuthSecrets {
  access: string;
  refresh: string;
}

export const ACCESS_TOKEN_SECONDS =
  15 * 60;

export const REFRESH_TOKEN_SECONDS =
  7 * 24 * 60 * 60;

export const MIN_AUTH_SECRET_LENGTH =
  32;

export function requireAuthSecret(
  configService: ConfigService,
  key:
    | 'JWT_SECRET'
    | 'JWT_REFRESH_SECRET'
): string {
  const secret =
    configService
      .get<string>(key)
      ?.trim();

  if (
    !secret ||
    secret.length <
      MIN_AUTH_SECRET_LENGTH
  ) {
    throw new Error(
      `${key} must contain at least ${MIN_AUTH_SECRET_LENGTH} characters.`
    );
  }

  return secret;
}

export function requireIndependentAuthSecrets(
  configService: ConfigService
): AuthSecrets {
  const access =
    requireAuthSecret(
      configService,
      'JWT_SECRET'
    );

  const refresh =
    requireAuthSecret(
      configService,
      'JWT_REFRESH_SECRET'
    );

  if (access === refresh) {
    throw new Error(
      'JWT_SECRET and JWT_REFRESH_SECRET must be different.'
    );
  }

  return {
    access,
    refresh,
  };
}

export function normalizeAuthRole(
  role: string
): AuthUserRole {
  if (
    role === 'admin' ||
    role === 'guest'
  ) {
    return role;
  }

  return 'user';
}
