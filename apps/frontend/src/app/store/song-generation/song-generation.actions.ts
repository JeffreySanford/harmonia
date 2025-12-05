/**
 * Song Generation Actions
 * Actions for song generation flows (metadata generation, song generation, progress tracking)
 */

import { createAction, props } from '@ngrx/store';
import {
  SongMetadata,
  SongGenerationResult,
  GenerationProgress,
} from './song-generation.state';

// Form actions
export const updateFormData = createAction(
  '[Song Generation] Update Form Data',
  props<{
    formData: Partial<{
      narrative: string;
      duration: number;
      model: string;
      genre: string;
      mood: string[];
    }>;
  }>()
);

export const resetForm = createAction('[Song Generation] Reset Form');

// Metadata generation actions
export const generateMetadata = createAction(
  '[Song Generation] Generate Metadata',
  props<{ narrative: string; duration: number; model: string }>()
);

export const generateMetadataSuccess = createAction(
  '[Song Generation] Generate Metadata Success',
  props<{ metadata: SongMetadata }>()
);

export const generateMetadataFailure = createAction(
  '[Song Generation] Generate Metadata Failure',
  props<{ error: string }>()
);

// Song generation actions
export const generateSong = createAction(
  '[Song Generation] Generate Song',
  props<{
    narrative: string;
    duration: number;
    model: string;
    metadata?: SongMetadata;
  }>()
);

export const generateSongSuccess = createAction(
  '[Song Generation] Generate Song Success',
  props<{ result: SongGenerationResult }>()
);

export const generateSongFailure = createAction(
  '[Song Generation] Generate Song Failure',
  props<{ error: string }>()
);

// Progress tracking actions
export const updateProgress = createAction(
  '[Song Generation] Update Progress',
  props<{ progress: GenerationProgress }>()
);

export const resetProgress = createAction('[Song Generation] Reset Progress');

// Result management actions
export const clearCurrentResult = createAction(
  '[Song Generation] Clear Current Result'
);

export const addToHistory = createAction(
  '[Song Generation] Add to History',
  props<{ result: SongGenerationResult }>()
);

export const clearHistory = createAction('[Song Generation] Clear History');

// Error handling
export const clearError = createAction('[Song Generation] Clear Error');
