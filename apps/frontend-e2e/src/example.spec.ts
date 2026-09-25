import { test, expect } from '@playwright/test';

test('shows the Harmonia landing page', async ({ page }) => {
  await page.goto('/');

  const heading = page
    .getByRole('main')
    .getByRole('heading', {
      name: 'Harmonia',
      exact: true,
    });

  await expect(heading).toBeVisible();
  await expect(
    page.getByText('AI-Powered Music Generation')
  ).toBeVisible();
});
