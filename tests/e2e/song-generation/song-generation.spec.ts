import { test, expect } from '@playwright/test';
import authHelper from '../helpers/auth';
import { FRONTEND_URL, TEST_USER } from '../auth/constants';

import {
  fillSongGenerationForm,
  submitSongGeneration,
  TEST_SONG_DATA,
} from './helpers';

const {
  loginViaModal,
  logoutIfNeeded,
} = authHelper;

test.describe('Song Generation Metadata Flow (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);

    await page.waitForLoadState(
      'domcontentloaded'
    );

    await page.context().clearCookies();

    await logoutIfNeeded(page);

    const login = await loginViaModal(
      page,
      {
        emailOrUsername: TEST_USER.email,
        password: TEST_USER.password,
      }
    );

    expect(login.responseStatus).toBe(200);

    await page.goto(
      `${FRONTEND_URL}/generate/song`,
      {
        waitUntil: 'domcontentloaded',
      }
    );

    await expect(page).toHaveURL(
      /.*\/generate\/song/
    );

    await expect(
      page.locator('.song-generation-page')
    ).toBeVisible();
  });

  test(
    'Scenario 1: Complete metadata generation request',
    async ({ page }) => {
      await expect(
        page.locator('mat-card-title').first()
      ).toContainText('Song Generation');

      await fillSongGenerationForm(
        page,
        TEST_SONG_DATA.complex
      );

      const result =
        await submitSongGeneration(page);

      expect(result.responseStatus).toBe(200);

      expect(result.body).toBeTruthy();
      expect(result.body.title).toBeTruthy();
      expect(result.body.lyrics).toBeTruthy();
      expect(result.body.genre).toBeTruthy();
      expect(result.body.mood).toBeTruthy();
    }
  );

  test(
    'Scenario 2: Metadata generation with a minimal valid narrative',
    async ({ page }) => {
      const expected = {
        title: 'Second Chance',
        lyrics:
          'We found our way back home together.',
        genre: 'pop',
        mood: 'hopeful',
        syllableCount: 10,
      };

      await page.route(
        '**/api/songs/generate-metadata',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(expected),
          });
        }
      );

      await fillSongGenerationForm(
        page,
        TEST_SONG_DATA.minimal
      );

      const result =
        await submitSongGeneration(page);

      expect(result.responseStatus).toBe(200);
      expect(result.body).toEqual(expected);
    }
  );

  test(
    'Scenario 3: Narrative validation controls generation',
    async ({ page }) => {
      const narrative = page
        .locator('.input-section textarea')
        .first();

      const generateButton = page.getByRole(
        'button',
        {
          name: 'Generate Song Metadata',
          exact: true,
        }
      );

      await expect(generateButton).toBeDisabled();

      await narrative.fill(
        'Too short'
      );

      await expect(generateButton).toBeDisabled();

      await narrative.fill(
        TEST_SONG_DATA.minimal.narrative
      );

      await expect(generateButton).toBeEnabled();
    }
  );

  test(
    'Scenario 5: Metadata generation error is shown to the user',
    async ({ page }) => {
      await page.route(
        '**/api/songs/generate-metadata',
        async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              message:
                'Synthetic metadata failure',
            }),
          });
        }
      );

      await fillSongGenerationForm(
        page,
        TEST_SONG_DATA.simple
      );

      const result =
        await submitSongGeneration(page);

      expect(result.responseStatus).toBe(500);

      const error = page.locator(
        '.error-message'
      );

      await expect(error).toBeVisible();

      await expect(error).toContainText(
        'Synthetic metadata failure'
      );
    }
  );
});
