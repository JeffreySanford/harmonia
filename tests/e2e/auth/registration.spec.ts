import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, TEST_USER } from './constants';
const { registerViaModal } = authHelper;

test.describe('Registration Flow (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.context().clearCookies();
  });

  test('Scenario 1: User Registration Flow', async ({ page }) => {
    // open user menu and sign up
    await page.click('nav button.user-menu-trigger');
    await page.click('button:has-text("Sign Up")', { force: true });
    await page.waitForSelector(
      'mat-dialog-content input[formControlName="email"]'
    );

    const uniqueId = Date.now();
    const randomSfx = Math.random().toString(36).slice(2, 8);
    const regUsername = `e2e_${uniqueId}_${randomSfx}`;
    const regEmail = `e2e_${uniqueId}_${randomSfx}@harmonia.local`;

    const reg = await registerViaModal(page, {
      username: regUsername,
      email: regEmail,
      password: TEST_USER.password,
    });
    expect([201, 200]).toContain(reg.responseStatus);
    expect(reg.body).toBeTruthy();
    expect(
      reg.body.accessToken || reg.body.access_token || reg.body.token
    ).toBeTruthy();
  });
});
