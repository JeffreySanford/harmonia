import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, ADMIN_USER } from './constants';
const { loginViaModal, logoutIfNeeded } = authHelper;

test.describe('Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.context().clearCookies();
  });

  test('Scenario 6: Logout Flow', async ({ page }) => {
    await logoutIfNeeded(page);
    const loginForSession = await loginViaModal(page, {
      emailOrUsername: ADMIN_USER.email,
      password: ADMIN_USER.password,
    });
    expect(loginForSession.responseStatus).toBe(200);
    await page.waitForURL('**/library');
    // Open user menu and click Logout
    await page.click('nav button.user-menu-trigger');
    await page.click('button:has-text("Logout")');
    // Wait until we are on the home page
    await page.waitForURL('**/');
    // Confirm no auth token in localStorage
    const authToken = await page.evaluate(() =>
      localStorage.getItem('auth_token')
    );
    expect(authToken).toBeNull();
  });
});
