/**
 * Datasets Selectors
 */

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DatasetsState } from './datasets.state';
import * as fromDatasets from './datasets.reducer';

export const selectDatasetsState =
  createFeatureSelector<DatasetsState>('datasets');
export const selectAllDatasets = createSelector(
  selectDatasetsState,
  fromDatasets.selectAll
);
export const selectDatasetsEntities = createSelector(
  selectDatasetsState,
  fromDatasets.selectEntities
);
export const selectDatasetsLoading = createSelector(
  selectDatasetsState,
  (state) => state.loading
);
export const selectDatasetSamplesLoading = createSelector(
  selectDatasetsState,
  (state) => state.samplesLoading
);
export const selectDatasetsError = createSelector(
  selectDatasetsState,
  (state) => state.error
);
export const selectSelectedDatasetId = createSelector(
  selectDatasetsState,
  (state) => state.selectedDatasetId
);
export const selectSelectedDataset = createSelector(
  selectDatasetsEntities,
  selectSelectedDatasetId,
  (entities, id) => (id ? entities[id] : null)
);
export const selectSelectedDatasetSamples = createSelector(
  selectDatasetsState,
  (state) => state.selectedSamples
);
export const selectDatasetsFilters = createSelector(
  selectDatasetsState,
  (state) => state.filters
);
export const selectFilteredDatasets = createSelector(
  selectAllDatasets,
  selectDatasetsFilters,
  (datasets, filters) =>
    datasets.filter((dataset) => {
      const search = filters.search.trim().toLowerCase();
      const matchesSearch =
        !search ||
        dataset.name.toLowerCase().includes(search) ||
        (dataset.description || '').toLowerCase().includes(search);
      const matchesCategory =
        !filters.category || dataset.category === filters.category;
      const matchesTags =
        filters.tags.length === 0 ||
        filters.tags.every((tag) => dataset.tags.includes(tag));
      return matchesSearch && matchesCategory && matchesTags;
    })
);
export const selectDatasetById = (id: string) =>
  createSelector(selectDatasetsEntities, (entities) => entities[id]);
