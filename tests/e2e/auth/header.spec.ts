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
    await expect(
      page.getByRole('menuitem', {
        name: 'Sign In',
        exact: true,
      })
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', {
        name: 'Sign Up',
        exact: true,
      })
    ).toBeVisible();
  });
});
