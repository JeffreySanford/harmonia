import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, ADMIN_USER, TEST_USER } from './constants';
const { loginViaModal, logoutIfNeeded } = authHelper;

test.describe('Login Flow (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.context().clearCookies();
  });

  test('Scenario 2: User Login Flow (Email)', async ({ page }) => {
    await logoutIfNeeded(page);
    const loginResult = await loginViaModal(page, {
      emailOrUsername: ADMIN_USER.email,
      password: ADMIN_USER.password,
    });
    expect(loginResult.responseStatus).toBe(200);
    expect(loginResult.body).toBeTruthy();
    expect(loginResult.body.accessToken || loginResult.body.token).toBeTruthy();
  });

  test('Scenario 2a: Test User Login Flow (Email)', async ({ page }) => {
    await logoutIfNeeded(page);
    const result = await loginViaModal(page, {
      emailOrUsername: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(result.responseStatus).toBe(200);
    expect(result.body).toBeTruthy();
    expect(result.body.accessToken || result.body.token).toBeTruthy();
  });

  test('Scenario 3: User Login Flow (Username)', async ({ page }) => {
    await logoutIfNeeded(page);
    const usernameLogin = await loginViaModal(page, {
      emailOrUsername: ADMIN_USER.username,
      password: ADMIN_USER.password,
    });
    expect(usernameLogin.responseStatus).toBe(200);
    expect(usernameLogin.body).toBeTruthy();
  });
});
