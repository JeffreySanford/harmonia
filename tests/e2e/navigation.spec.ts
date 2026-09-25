import { test, expect } from '@playwright/test';
import authHelper from './helpers/auth';

const { loginViaModal, logoutIfNeeded } = authHelper;
const FRONTEND_URL = 'http://localhost:4200';
const BACKEND_URL = 'http://localhost:3000';

test.describe('Navigation & Session E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
    });
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Guest: access /generate/song should redirect to /', async ({
    page,
  }) => {
    await page.goto(`${FRONTEND_URL}/generate/song`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(FRONTEND_URL + '/');
  });

  test('Guest: access /generate/music should redirect to /', async ({
    page,
  }) => {
    await page.goto(`${FRONTEND_URL}/generate/music`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(FRONTEND_URL + '/');
  });

  test('Session invalidation (expired token) redirects guest on protected generate routes', async ({
    page,
  }) => {
    // Login via modal
    await logoutIfNeeded(page);
    const admin = {
      email: process.env.E2E_ADMIN_EMAIL!,
      password: process.env.E2E_ADMIN_PASSWORD!,
    };
    const login = await loginViaModal(page, {
      emailOrUsername: admin.email,
      password: admin.password,
    });
    expect(login.responseStatus).toBe(200);
    await page.waitForURL('**/library');

    // Navigate to a protected generate route
    await page.goto(`${FRONTEND_URL}/generate/song`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*\/generate\/song/);

    // Simulate token invalidation by corrupting localStorage token
    await page.evaluate(() =>
      localStorage.setItem('auth_token', 'expired.jwt.token')
    );
    // Reload the page. The app has background health traffic,
    // so do not wait for global network idle here.
    await page.reload({
      waitUntil: 'domcontentloaded',
    });

    // Invalid session should clear persisted auth and redirect home.
    await expect(page).toHaveURL(
      FRONTEND_URL + '/',
      { timeout: 10000 }
    );

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            localStorage.getItem('auth_token')
          ),
        { timeout: 10000 }
      )
      .toBeNull();
  });

  test('Login modal shows backend health indicator in dev', async ({
    page,
  }) => {
    await page.goto(FRONTEND_URL);
    // Open login modal
    await page
      .getByRole('button', {
        name: 'Sign In',
        exact: true,
      })
      .first()
      .click({ force: true });
    await page.waitForSelector(
      'mat-dialog-content input[formControlName="emailOrUsername"]'
    );
    // Health indicator should be present when backend reachable
    const health = page.locator('.backend-health');
    await expect(health).toBeVisible();
    await expect(health).toContainText(/Backend (OK|Unreachable)/i);
  });
});
