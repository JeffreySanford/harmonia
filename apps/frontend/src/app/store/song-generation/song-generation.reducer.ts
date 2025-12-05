/**
 * Song Generation Reducer
 * Handles state updates for song generation
 */

import { createReducer, on } from '@ngrx/store';
import {
  updateFormData,
  resetForm,
  generateMetadata,
  generateMetadataSuccess,
  generateMetadataFailure,
  generateSong,
  generateSongSuccess,
  generateSongFailure,
  updateProgress,
  resetProgress,
  clearCurrentResult,
  addToHistory,
  clearHistory,
  clearError,
} from './song-generation.actions';
import { initialSongGenerationState } from './song-generation.state';

export const songGenerationReducer = createReducer(
  initialSongGenerationState,

  // Form actions
  on(updateFormData, (state, { formData }) => ({
    ...state,
    formData: { ...state.formData, ...formData },
  })),

  on(resetForm, (state) => ({
    ...state,
    formData: initialSongGenerationState.formData,
  })),

  // Metadata generation
  on(generateMetadata, (state, { narrative, duration, model }) => ({
    ...state,
    loading: true,
    error: null,
    currentRequest: { narrative, duration, model },
    progress: {
      stage: 'generating-metadata',
      progress: 0,
      message: 'Generating song metadata...',
    },
  })),

  on(generateMetadataSuccess, (state, { metadata }) => ({
    ...state,
    loading: false,
    progress: {
      stage: 'idle',
      progress: 100,
      message: 'Metadata generated successfully',
    },
    formData: {
      ...state.formData,
      genre: metadata.genre,
      mood: metadata.mood,
    },
  })),

  on(generateMetadataFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
    progress: {
      stage: 'error',
      progress: 0,
      message: `Failed to generate metadata: ${error}`,
    },
  })),

  // Song generation
  on(generateSong, (state, { narrative, duration, model }) => ({
    ...state,
    loading: true,
    error: null,
    currentRequest: { narrative, duration, model },
    progress: {
      stage: 'generating-song',
      progress: 0,
      message: 'Generating song...',
    },
  })),

  on(generateSongSuccess, (state, { result }) => ({
    ...state,
    loading: false,
    currentResult: result,
    progress: {
      stage: 'complete',
      progress: 100,
      message: 'Song generated successfully',
    },
  })),

  on(generateSongFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
    progress: {
      stage: 'error',
      progress: 0,
      message: `Failed to generate song: ${error}`,
    },
  })),

  // Progress tracking
  on(updateProgress, (state, { progress }) => ({
    ...state,
    progress,
  })),

  on(resetProgress, (state) => ({
    ...state,
    progress: initialSongGenerationState.progress,
  })),

  // Result management
  on(clearCurrentResult, (state) => ({
    ...state,
    currentResult: null,
  })),

  on(addToHistory, (state, { result }) => ({
    ...state,
    history: [result, ...state.history].slice(0, 10), // Keep last 10 results
  })),

  on(clearHistory, (state) => ({
    ...state,
    history: [],
  })),

  // Error handling
  on(clearError, (state) => ({
    ...state,
    error: null,
  }))
);
