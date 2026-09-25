/// <reference lib="dom" />

import { Page, expect } from '@playwright/test';

export type SongGenerationData = {
  narrative: string;
};

/**
 * Fill the current Song Generation metadata form.
 *
 * The current UI accepts a narrative plus duration/model controls.
 * Duration defaults to 30 seconds, which is sufficient for these E2E tests.
 */
export async function fillSongGenerationForm(
  page: Page,
  data: SongGenerationData
): Promise<void> {
  const narrative = page
    .locator('.input-section textarea')
    .first();

  await expect(narrative).toBeVisible();

  await narrative.fill(data.narrative);
}

/**
 * Submit the current metadata-generation workflow.
 */
export async function submitSongGeneration(
  page: Page
): Promise<{
  responseStatus: number;
  body?: any;
}> {
  const generateButton = page.getByRole(
    'button',
    {
      name: 'Generate Song Metadata',
      exact: true,
    }
  );

  await expect(generateButton).toBeEnabled();

  const [response] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes(
          '/api/songs/generate-metadata'
        ) &&
        resp.request().method() === 'POST'
    ),
    generateButton.click(),
  ]);

  let body: any = null;

  try {
    body = await response.json();
  } catch {
    // Some error responses may not carry JSON.
  }

  return {
    responseStatus: response.status(),
    body,
  };
}

export const TEST_SONG_DATA = {
  simple: {
    narrative:
      'A bright song about friendship, sunshine, and finding hope together after a difficult week.',
  },

  complex: {
    narrative:
      'An epic tale of adventure and discovery across vast landscapes, where old friends overcome fear and return home stronger.',
  },

  minimal: {
    narrative:
      'A reflective love song about two people reconnecting after years apart and deciding to begin again together.',
  },
};
