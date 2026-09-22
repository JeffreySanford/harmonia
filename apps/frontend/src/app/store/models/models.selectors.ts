/**
 * Models Selectors
 */

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ModelsState } from './models.state';
import * as fromModels from './models.reducer';

export const selectModelsState = createFeatureSelector<ModelsState>('models');
export const selectAllModels = createSelector(selectModelsState, fromModels.selectAll);
export const selectModelsEntities = createSelector(
  selectModelsState,
  fromModels.selectEntities
);
export const selectModelsLoading = createSelector(
  selectModelsState,
  (state) => state.loading
);
export const selectModelsError = createSelector(
  selectModelsState,
  (state) => state.error
);
export const selectSelectedModelId = createSelector(
  selectModelsState,
  (state) => state.selectedModelId
);
export const selectSelectedModel = createSelector(
  selectModelsEntities,
  selectSelectedModelId,
  (entities, id) => (id ? entities[id] : null)
);
export const selectModelsFilters = createSelector(
  selectModelsState,
  (state) => state.filters
);
export const selectFilteredModels = createSelector(
  selectAllModels,
  selectModelsFilters,
  (models, filters) =>
    models.filter((model) => {
      const search = filters.search.trim().toLowerCase();
      const matchesSearch =
        !search ||
        model.name.toLowerCase().includes(search) ||
        model.version.toLowerCase().includes(search);
      const matchesType =
        !filters.modelType || model.type === filters.modelType;
      const matchesTags =
        filters.tags.length === 0 ||
        filters.tags.every((tag) => model.tags.includes(tag));
      return matchesSearch && matchesType && matchesTags;
    })
);
export const selectModelById = (id: string) =>
  createSelector(selectModelsEntities, (entities) => entities[id]);
