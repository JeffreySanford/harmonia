/**
 * Models Actions
 */

import { createAction, props } from '@ngrx/store';
import { ModelArtifact } from './models.state';

export const loadModels = createAction('[Models] Load Models');
export const loadModelsSuccess = createAction(
  '[Models] Load Models Success',
  props<{ models: ModelArtifact[] }>()
);
export const loadModelsFailure = createAction(
  '[Models] Load Models Failure',
  props<{ error: string }>()
);

export const loadModel = createAction(
  '[Models] Load Model',
  props<{ id: string }>()
);
export const loadModelSuccess = createAction(
  '[Models] Load Model Success',
  props<{ model: ModelArtifact }>()
);
export const loadModelFailure = createAction(
  '[Models] Load Model Failure',
  props<{ error: string }>()
);

export const selectModel = createAction(
  '[Models] Select Model',
  props<{ id: string }>()
);
export const deselectModel = createAction('[Models] Deselect Model');

export const createModel = createAction(
  '[Models] Create Model',
  props<{
    model: Omit<ModelArtifact, 'id' | 'createdAt' | 'updatedAt'>;
  }>()
);
export const createModelSuccess = createAction(
  '[Models] Create Model Success',
  props<{ model: ModelArtifact }>()
);
export const createModelFailure = createAction(
  '[Models] Create Model Failure',
  props<{ error: string }>()
);

export const updateModel = createAction(
  '[Models] Update Model',
  props<{ id: string; changes: Partial<ModelArtifact> }>()
);
export const updateModelSuccess = createAction(
  '[Models] Update Model Success',
  props<{ model: ModelArtifact }>()
);
export const updateModelFailure = createAction(
  '[Models] Update Model Failure',
  props<{ error: string }>()
);

export const deleteModel = createAction(
  '[Models] Delete Model',
  props<{ id: string }>()
);
export const deleteModelSuccess = createAction(
  '[Models] Delete Model Success',
  props<{ id: string }>()
);
export const deleteModelFailure = createAction(
  '[Models] Delete Model Failure',
  props<{ error: string }>()
);

export const setSearchFilter = createAction(
  '[Models] Set Search Filter',
  props<{ search: string }>()
);
export const setModelTypeFilter = createAction(
  '[Models] Set Model Type Filter',
  props<{ modelType: string | null }>()
);
export const setTagsFilter = createAction(
  '[Models] Set Tags Filter',
  props<{ tags: string[] }>()
);
export const clearFilters = createAction('[Models] Clear Filters');
