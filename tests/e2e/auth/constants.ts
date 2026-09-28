import { test } from '@playwright/test';

export const FRONTEND_URL = 'http://localhost:4200';
export const BACKEND_URL = 'http://localhost:3000';
export const TEST_TIMEOUT = 30000;

export interface E2ECredentials {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Required E2E environment variable is missing: ${name}`
    );
  }

  return value;
}

export const TEST_USER: E2ECredentials = {
  get username() {
    return readRequiredEnv(
      'E2E_TEST_USER_USERNAME'
    );
  },
  get email() {
    return readRequiredEnv(
      'E2E_TEST_USER_EMAIL'
    );
  },
  get password() {
    return readRequiredEnv(
      'E2E_TEST_USER_PASSWORD'
    );
  },
};

export const ADMIN_USER: E2ECredentials = {
  get username() {
    return readRequiredEnv(
      'E2E_ADMIN_USERNAME'
    );
  },
  get email() {
    return readRequiredEnv(
      'E2E_ADMIN_EMAIL'
    );
  },
  get password() {
    return readRequiredEnv(
      'E2E_ADMIN_PASSWORD'
    );
  },
};

export function assertEnvVars() {
  if (
    !process.env.E2E_ADMIN_EMAIL ||
    !process.env.E2E_ADMIN_PASSWORD ||
    !process.env.E2E_ADMIN_USERNAME
  ) {
    throw new Error(
      'E2E admin credentials must be set in environment variables: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_USERNAME'
    );
  }

  if (
    !process.env.E2E_TEST_USER_EMAIL ||
    !process.env.E2E_TEST_USER_PASSWORD ||
    !process.env.E2E_TEST_USER_USERNAME
  ) {
    throw new Error(
      'E2E test user credentials must be set in environment variables: E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD, E2E_TEST_USER_USERNAME'
    );
  }
}

test.beforeAll(() => {
  assertEnvVars();
});
