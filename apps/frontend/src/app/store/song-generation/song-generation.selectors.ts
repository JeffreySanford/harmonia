/**
 * Song Generation Selectors
 * Selectors for accessing song generation state
 */

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SongGenerationState } from './song-generation.state';

// Feature selector
export const selectSongGenerationState = createFeatureSelector<SongGenerationState>('songGeneration');

// Basic selectors
export const selectFormData = createSelector(
  selectSongGenerationState,
  (state) => state.formData
);

export const selectCurrentRequest = createSelector(
  selectSongGenerationState,
  (state) => state.currentRequest
);

export const selectProgress = createSelector(
  selectSongGenerationState,
  (state) => state.progress
);

export const selectCurrentResult = createSelector(
  selectSongGenerationState,
  (state) => state.currentResult
);

export const selectHistory = createSelector(
  selectSongGenerationState,
  (state) => state.history
);

export const selectLoading = createSelector(
  selectSongGenerationState,
  (state) => state.loading
);

export const selectError = createSelector(
  selectSongGenerationState,
  (state) => state.error
);

// Computed selectors
export const selectIsGenerating = createSelector(
  selectProgress,
  (progress) => progress.stage === 'generating-metadata' || progress.stage === 'generating-song'
);

export const selectIsComplete = createSelector(
  selectProgress,
  (progress) => progress.stage === 'complete'
);

export const selectHasError = createSelector(
  selectProgress,
  (progress) => progress.stage === 'error'
);

export const selectProgressPercentage = createSelector(
  selectProgress,
  (progress) => progress.progress
);

export const selectProgressMessage = createSelector(
  selectProgress,
  (progress) => progress.message
);

export const selectHasCurrentResult = createSelector(
  selectCurrentResult,
  (result) => result !== null
);

export const selectHistoryCount = createSelector(
  selectHistory,
  (history) => history.length
);