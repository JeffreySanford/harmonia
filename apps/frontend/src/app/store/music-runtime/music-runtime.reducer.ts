import { createReducer, on } from '@ngrx/store';
import * as MusicRuntimeActions from './music-runtime.actions';
import {
  initialMusicRuntimeState,
  MusicRuntimeFeatureState,
} from './music-runtime.state';

export const musicRuntimeReducer = createReducer<MusicRuntimeFeatureState>(
  initialMusicRuntimeState,
  on(MusicRuntimeActions.loadCatalog, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(MusicRuntimeActions.loadCatalogSuccess, (state, { catalog }) => ({
    ...state,
    providers: catalog.providers,
    models: catalog.models,
    hardware: catalog.hardware,
    status: catalog.status,
    selectedProviderId:
      state.selectedProviderId || catalog.status.providerId || null,
    selectedModelId: state.selectedModelId || catalog.status.modelId || null,
    loading: false,
  })),
  on(MusicRuntimeActions.loadCatalogFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(MusicRuntimeActions.chooseProvider, (state, { providerId }) => ({
    ...state,
    selectedProviderId: providerId,
    selectedModelId:
      state.models.find(
        (model) => model.providerId === providerId && model.selectable
      )?.id || null,
    error: null,
  })),
  on(MusicRuntimeActions.selectModel, (state, { modelId }) => {
    const model = state.models.find((candidate) => candidate.id === modelId);
    return {
      ...state,
      selectedModelId: modelId,
      selectedProviderId: model?.providerId || state.selectedProviderId,
      switching: true,
      error: null,
    };
  }),
  on(MusicRuntimeActions.selectModelSuccess, (state, { status }) => ({
    ...state,
    status,
    switching: false,
    error: null,
  })),
  on(MusicRuntimeActions.selectModelFailure, (state, { error }) => ({
    ...state,
    switching: false,
    error,
  })),
  on(MusicRuntimeActions.stopRuntime, (state) => ({
    ...state,
    switching: true,
    error: null,
  })),
  on(MusicRuntimeActions.stopRuntimeSuccess, (state, { status }) => ({
    ...state,
    status,
    switching: false,
    error: null,
  })),
  on(MusicRuntimeActions.stopRuntimeFailure, (state, { error }) => ({
    ...state,
    switching: false,
    error,
  })),
  on(MusicRuntimeActions.runtimeStatusReceived, (state, { status }) => ({
    ...state,
    status,
    hardware: status.hardware,
    selectedProviderId:
      status.providerId || state.selectedProviderId,
    selectedModelId: status.modelId || state.selectedModelId,
    switching: !['ready', 'stopped', 'error'].includes(status.state),
    error: status.error,
  })),
  on(MusicRuntimeActions.clearError, (state) => ({
    ...state,
    error: null,
  }))
);
