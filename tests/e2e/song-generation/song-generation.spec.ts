import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, TEST_USER } from '../auth/constants';
import {
  fillSongGenerationForm,
  submitSongGeneration,
  waitForSongGenerationResult,
  verifySongResult,
  TEST_SONG_DATA
} from './helpers';

const { loginViaModal, logoutIfNeeded } = authHelper;

test.describe('Song Generation Flow (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.context().clearCookies();

    // Login first
    await logoutIfNeeded(page);
    await loginViaModal(page, {
      emailOrUsername: TEST_USER.email,
      password: TEST_USER.password,
    });

    // Navigate to song generation page
    await page.goto(`${FRONTEND_URL}/generate/song`);
    await page.waitForLoadState('networkidle');
  });

  test('Scenario 1: Complete Song Generation Flow', async ({ page }) => {
    // Verify we're on the song generation page
    await expect(page).toHaveURL(/.*generate\/song/);
    await expect(page.locator('h1')).toContainText('Generate Song');

    // Fill out the complete song generation form
    await fillSongGenerationForm(page, TEST_SONG_DATA.complex);

    // Submit and verify API response
    const result = await submitSongGeneration(page);
    expect(result.responseStatus).toBe(200);
    expect(result.body).toBeTruthy();
    expect(result.body.song).toBeTruthy();

    // Wait for and verify results
    await waitForSongGenerationResult(page);
    await verifySongResult(page, TEST_SONG_DATA.complex);
  });

  test('Scenario 2: Song Generation with Minimal Properties', async ({ page }) => {
    // Fill minimal required data
    await fillSongGenerationForm(page, TEST_SONG_DATA.minimal);

    // Submit and verify
    const result = await submitSongGeneration(page);
    expect(result.responseStatus).toBe(200);

    // Verify result display
    await waitForSongGenerationResult(page);
    await verifySongResult(page, TEST_SONG_DATA.minimal);
  });

  test('Scenario 3: Song Generation Form Validation', async ({ page }) => {
    // Try to generate without narrative - button should be disabled
    const generateButton = page.locator('button:has-text("Generate Song")');
    await expect(generateButton).toBeDisabled();

    // Enter narrative but invalid tempo
    await fillSongGenerationForm(page, {
      narrative: 'Test narrative',
      tempo: NaN // This will result in invalid input
    });

    // Manually set invalid tempo to test validation
    const tempoInput = page.locator('input[formControlName="tempo"]');
    await tempoInput.fill('invalid');

    // Button should be disabled due to validation
    await expect(generateButton).toBeDisabled();

    // Fix tempo
    await tempoInput.fill('100');
    await expect(generateButton).toBeEnabled();
  });

  test('Scenario 5: Song Generation Error Handling', async ({ page }) => {
    // Fill form with valid data first
    await fillSongGenerationForm(page, TEST_SONG_DATA.simple);

    // Mock a backend error by intercepting the request
    await page.route('**/api/songs/generate-song', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    // Submit and verify error handling
    const result = await submitSongGeneration(page);
    expect(result.responseStatus).toBe(500);

    // Verify error message is displayed to user
    await page.waitForSelector('.error-message', { timeout: 5000 });
    const errorMessage = page.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('error');
  });
});