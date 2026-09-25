import { createAction, props } from '@ngrx/store';
import {
  MusicRuntimeCatalogResponse,
  MusicRuntimeSelectionAccepted,
  MusicRuntimeStatus,
} from './music-runtime.state';

export const loadCatalog = createAction('[Music Runtime] Load Catalog');
export const loadCatalogSuccess = createAction(
  '[Music Runtime] Load Catalog Success',
  props<{ catalog: MusicRuntimeCatalogResponse }>()
);
export const loadCatalogFailure = createAction(
  '[Music Runtime] Load Catalog Failure',
  props<{ error: string }>()
);

export const chooseProvider = createAction(
  '[Music Runtime] Choose Provider',
  props<{ providerId: string }>()
);

export const selectModel = createAction(
  '[Music Runtime] Select Model',
  props<{ modelId: string }>()
);
export const selectModelAccepted = createAction(
  '[Music Runtime] Select Model Accepted',
  props<{ acceptance: MusicRuntimeSelectionAccepted }>()
);
export const selectModelFailure = createAction(
  '[Music Runtime] Select Model Failure',
  props<{ error: string }>()
);

export const stopRuntime = createAction('[Music Runtime] Stop Runtime');
export const stopRuntimeSuccess = createAction(
  '[Music Runtime] Stop Runtime Success',
  props<{ status: MusicRuntimeStatus }>()
);
export const stopRuntimeFailure = createAction(
  '[Music Runtime] Stop Runtime Failure',
  props<{ error: string }>()
);

export const runtimeStatusReceived = createAction(
  '[Music Runtime] Runtime Status Received',
  props<{ status: MusicRuntimeStatus }>()
);

export const clearError = createAction('[Music Runtime] Clear Error');
