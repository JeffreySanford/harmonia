/// <reference lib="dom" />

import { Page, expect } from '@playwright/test';

export type SongGenerationData = {
  narrative: string;
  lyricsAnalysis?: string;
  melody?: string;
  tempo: number;
  key?: string;
  instrumentation?: string;
  includeIntro?: boolean;
  includeOutro?: boolean;
};

/**
 * Helper function to fill out the song generation form
 */
export async function fillSongGenerationForm(
  page: Page,
  data: SongGenerationData
): Promise<void> {
  // Fill narrative
  const narrativeTextarea = page.locator('textarea[placeholder*="narrative"]');
  await narrativeTextarea.fill(data.narrative);

  // Select lyrics analysis if provided
  if (data.lyricsAnalysis) {
    const lyricsAnalysisSelect = page.locator(
      'mat-select[formControlName="lyricsAnalysis"]'
    );
    await lyricsAnalysisSelect.click();
    await page.waitForSelector('mat-option');
    await page
      .locator('mat-option')
      .filter({ hasText: data.lyricsAnalysis })
      .click();
  }

  // Fill melody if provided
  if (data.melody) {
    const melodyInput = page.locator('input[formControlName="melody"]');
    await melodyInput.fill(data.melody);
  }

  // Fill tempo (required)
  const tempoInput = page.locator('input[formControlName="tempo"]');
  await tempoInput.fill(data.tempo.toString());

  // Select key if provided
  if (data.key) {
    const keySelect = page.locator('mat-select[formControlName="key"]');
    await keySelect.click();
    await page.waitForSelector('mat-option');
    await page.locator('mat-option').filter({ hasText: data.key }).click();
  }

  // Select instrumentation if provided
  if (data.instrumentation) {
    const instrumentationSelect = page.locator(
      'mat-select[formControlName="instrumentation"]'
    );
    await instrumentationSelect.click();
    await page.waitForSelector('mat-option');
    await page
      .locator('mat-option')
      .filter({ hasText: data.instrumentation })
      .click();
  }

  // Configure intro/outro if specified
  if (data.includeIntro !== undefined) {
    const introCheckbox = page
      .locator('mat-checkbox')
      .filter({ hasText: 'Include Intro' });
    const isChecked = await introCheckbox.getAttribute('aria-checked');
    if (
      (data.includeIntro && isChecked !== 'true') ||
      (!data.includeIntro && isChecked === 'true')
    ) {
      await introCheckbox.click();
    }
  }

  if (data.includeOutro !== undefined) {
    const outroCheckbox = page
      .locator('mat-checkbox')
      .filter({ hasText: 'Include Outro' });
    const isChecked = await outroCheckbox.getAttribute('aria-checked');
    if (
      (data.includeOutro && isChecked !== 'true') ||
      (!data.includeOutro && isChecked === 'true')
    ) {
      await outroCheckbox.click();
    }
  }
}

/**
 * Helper function to submit song generation and wait for response
 */
export async function submitSongGeneration(page: Page): Promise<{
  responseStatus: number;
  body?: any;
}> {
  const generateButton = page.locator('button:has-text("Generate Song")');

  const [generateResponse] = await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/songs/generate-song') &&
        resp.request().method() === 'POST'
    ),
    generateButton.click(),
  ]);

  const status = generateResponse.status();
  let body;
  try {
    body = await generateResponse.json();
  } catch (e) {
    // Response might not be JSON
  }

  return {
    responseStatus: status,
    body,
  };
}

/**
 * Helper function to wait for song generation result
 */
export async function waitForSongGenerationResult(
  page: Page,
  timeout = 30000
): Promise<void> {
  await page.waitForSelector('.song-result', { timeout });
}

/**
 * Helper function to verify song result contains expected properties
 */
export async function verifySongResult(
  page: Page,
  expectedProperties: Partial<SongGenerationData>
): Promise<void> {
  const songResult = page.locator('.song-result');
  await expect(songResult).toBeVisible();

  if (expectedProperties.melody) {
    await expect(songResult).toContainText(
      `Melody: ${expectedProperties.melody}`
    );
  }

  if (expectedProperties.tempo) {
    await expect(songResult).toContainText(
      `Tempo: ${expectedProperties.tempo}`
    );
  }

  if (expectedProperties.key) {
    await expect(songResult).toContainText(`Key: ${expectedProperties.key}`);
  }

  if (expectedProperties.instrumentation) {
    await expect(songResult).toContainText(
      `Instrumentation: ${expectedProperties.instrumentation}`
    );
  }
}

/**
 * Predefined test data for song generation
 */
export const TEST_SONG_DATA = {
  simple: {
    narrative: 'A happy song about sunshine and friendship.',
    tempo: 120,
    key: 'C Major',
    instrumentation: 'Piano',
  },
  complex: {
    narrative:
      'An epic tale of adventure and discovery across vast landscapes.',
    lyricsAnalysis: 'Narrative',
    melody: 'Epic and adventurous melody',
    tempo: 140,
    key: 'D Minor',
    instrumentation: 'Full Orchestra',
    includeIntro: true,
    includeOutro: true,
  },
  minimal: {
    narrative: 'Simple love song.',
    tempo: 100,
  },
};
