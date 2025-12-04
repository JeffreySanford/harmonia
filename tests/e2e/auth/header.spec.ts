import { test, expect } from '@playwright/test';
import { FRONTEND_URL } from './constants';

test.describe('Header Menu (Guest)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Header Menu - Landing shows guest options', async ({ page }) => {
    await expect(page.locator('nav button.user-menu-trigger')).toBeVisible();
    await page.click('nav button.user-menu-trigger');
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign Up")')).toBeVisible();
  });
});
