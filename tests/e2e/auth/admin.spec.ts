import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, ADMIN_USER } from './constants';
const { loginViaModal, logoutIfNeeded } = authHelper;

test.describe('Admin Access Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.context().clearCookies();
  });

  test('Scenario 5: Admin Route Access', async ({ page }) => {
    await logoutIfNeeded(page);
    const loginForAdmin = await loginViaModal(page, {
      emailOrUsername: ADMIN_USER.email,
      password: ADMIN_USER.password,
    });
    expect(loginForAdmin.responseStatus).toBe(200);
    await page.goto(`${FRONTEND_URL}/admin`);
    await expect(page).toHaveURL(/.*\/admin/);
    await page.click('nav button.user-menu-trigger');
    const adminOption = page.locator('button:has-text("Admin Dashboard")');
    await expect(adminOption).toBeVisible();
  });
});
