import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MusicRuntimeFeatureState } from './music-runtime.state';

export const selectMusicRuntimeState =
  createFeatureSelector<MusicRuntimeFeatureState>('musicRuntime');

export const selectRuntimeProviders = createSelector(
  selectMusicRuntimeState,
  (state) => state.providers
);

export const selectRuntimeModels = createSelector(
  selectMusicRuntimeState,
  (state) => state.models
);

export const selectRuntimeHardware = createSelector(
  selectMusicRuntimeState,
  (state) => state.hardware
);

export const selectRuntimeStatus = createSelector(
  selectMusicRuntimeState,
  (state) => state.status
);

export const selectSelectedRuntimeProviderId = createSelector(
  selectMusicRuntimeState,
  (state) => state.selectedProviderId
);

export const selectSelectedRuntimeModelId = createSelector(
  selectMusicRuntimeState,
  (state) => state.selectedModelId
);

export const selectRuntimeSwitching = createSelector(
  selectMusicRuntimeState,
  (state) => state.switching
);

export const selectActiveRuntimeSelectionOperationId =
  createSelector(
    selectMusicRuntimeState,
    (state) => state.activeSelectionOperationId
  );

export const selectRuntimeLoading = createSelector(
  selectMusicRuntimeState,
  (state) => state.loading
);

export const selectRuntimeError = createSelector(
  selectMusicRuntimeState,
  (state) => state.error
);

export const selectModelsForSelectedProvider = createSelector(
  selectRuntimeModels,
  selectSelectedRuntimeProviderId,
  (models, providerId) =>
    providerId
      ? models.filter((model) => model.providerId === providerId)
      : []
);

export const selectSelectedRuntimeModel = createSelector(
  selectRuntimeModels,
  selectSelectedRuntimeModelId,
  (models, modelId) =>
    modelId ? models.find((model) => model.id === modelId) || null : null
);

export const selectRuntimeReady = createSelector(
  selectRuntimeStatus,
  (status) => status?.state === 'ready' && status.healthy
);
