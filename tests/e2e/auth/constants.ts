import { test } from '@playwright/test';

export const FRONTEND_URL = 'http://localhost:4200';
export const BACKEND_URL = 'http://localhost:3000';
export const TEST_TIMEOUT = 30000;

export const TEST_USER = {
  username: process.env.E2E_TEST_USER_USERNAME!,
  email: process.env.E2E_TEST_USER_EMAIL!,
  password: process.env.E2E_TEST_USER_PASSWORD!,
};

export const ADMIN_USER = {
  username: process.env.E2E_ADMIN_USERNAME!,
  email: process.env.E2E_ADMIN_EMAIL!,
  password: process.env.E2E_ADMIN_PASSWORD!,
};

export function assertEnvVars() {
  // Validate E2E env vars; throw if missing
  if (!ADMIN_USER.email || !ADMIN_USER.password || !ADMIN_USER.username) {
    throw new Error(
      'E2E admin credentials must be set in environment variables: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_USERNAME'
    );
  }
  if (!TEST_USER.email || !TEST_USER.password || !TEST_USER.username) {
    throw new Error(
      'E2E test user credentials must be set in environment variables: E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD, E2E_TEST_USER_USERNAME'
    );
  }
}

test.beforeAll(() => {
  assertEnvVars();
});
