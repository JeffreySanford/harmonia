import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, ADMIN_USER } from './constants';
const { loginViaModal, logoutIfNeeded } = authHelper;

test.describe('Protected Routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.context().clearCookies();
  });

  test('Scenario 4: Protected Route Access', async ({ page }) => {
    // Guest redirect
    await page.goto(`${FRONTEND_URL}/library`);
    await expect(page).toHaveURL(FRONTEND_URL + '/');

    // Login and access protected routes
    const loginProtected = await loginViaModal(page, {
      emailOrUsername: ADMIN_USER.email,
      password: ADMIN_USER.password,
    });
    expect(loginProtected.responseStatus).toBe(200);
    await page.goto(`${FRONTEND_URL}/profile`);
    await expect(page).toHaveURL(/.*\/profile/);
    await page.goto(`${FRONTEND_URL}/admin`);
    await expect(page).toHaveURL(/.*\/admin/);
  });
});
