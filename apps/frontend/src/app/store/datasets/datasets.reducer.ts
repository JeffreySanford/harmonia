/**
 * Datasets Reducer
 */

import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { Dataset, DatasetsState } from './datasets.state';
import * as DatasetsActions from './datasets.actions';

export const datasetsAdapter: EntityAdapter<Dataset> =
  createEntityAdapter<Dataset>({
    selectId: (dataset) => dataset.id,
    sortComparer: (a, b) => a.name.localeCompare(b.name),
  });

export const initialDatasetsState: DatasetsState =
  datasetsAdapter.getInitialState({
    selectedDatasetId: null,
    selectedSamples: [],
    loading: false,
    samplesLoading: false,
    error: null,
    filters: {
      search: '',
      category: null,
      tags: [],
    },
  });

export const datasetsReducer = createReducer(
  initialDatasetsState,
  on(DatasetsActions.loadDatasets, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(DatasetsActions.loadDatasetsSuccess, (state, { datasets }) =>
    datasetsAdapter.setAll(datasets, { ...state, loading: false })
  ),
  on(DatasetsActions.loadDatasetsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(DatasetsActions.loadDataset, (state) => ({ ...state, loading: true })),
  on(DatasetsActions.loadDatasetSuccess, (state, { dataset }) =>
    datasetsAdapter.upsertOne(dataset, { ...state, loading: false })
  ),
  on(DatasetsActions.loadDatasetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(DatasetsActions.selectDataset, (state, { id }) => ({
    ...state,
    selectedDatasetId: id,
    selectedSamples: [],
  })),
  on(DatasetsActions.deselectDataset, (state) => ({
    ...state,
    selectedDatasetId: null,
    selectedSamples: [],
  })),
  on(DatasetsActions.loadDatasetSamples, (state) => ({
    ...state,
    samplesLoading: true,
    error: null,
  })),
  on(DatasetsActions.loadDatasetSamplesSuccess, (state, { samples }) => ({
    ...state,
    selectedSamples: samples,
    samplesLoading: false,
  })),
  on(DatasetsActions.loadDatasetSamplesFailure, (state, { error }) => ({
    ...state,
    samplesLoading: false,
    error,
  })),
  on(DatasetsActions.createDataset, (state) => ({ ...state, loading: true })),
  on(DatasetsActions.createDatasetSuccess, (state, { dataset }) =>
    datasetsAdapter.addOne(dataset, { ...state, loading: false })
  ),
  on(DatasetsActions.createDatasetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(DatasetsActions.updateDataset, (state) => ({ ...state, loading: true })),
  on(DatasetsActions.updateDatasetSuccess, (state, { dataset }) =>
    datasetsAdapter.upsertOne(dataset, { ...state, loading: false })
  ),
  on(DatasetsActions.updateDatasetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(DatasetsActions.deleteDataset, (state) => ({ ...state, loading: true })),
  on(DatasetsActions.deleteDatasetSuccess, (state, { id }) =>
    datasetsAdapter.removeOne(id, {
      ...state,
      loading: false,
      selectedDatasetId:
        state.selectedDatasetId === id ? null : state.selectedDatasetId,
      selectedSamples:
        state.selectedDatasetId === id ? [] : state.selectedSamples,
    })
  ),
  on(DatasetsActions.deleteDatasetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(DatasetsActions.setSearchFilter, (state, { search }) => ({
    ...state,
    filters: { ...state.filters, search },
  })),
  on(DatasetsActions.setCategoryFilter, (state, { category }) => ({
    ...state,
    filters: { ...state.filters, category },
  })),
  on(DatasetsActions.setTagsFilter, (state, { tags }) => ({
    ...state,
    filters: { ...state.filters, tags },
  })),
  on(DatasetsActions.clearFilters, (state) => ({
    ...state,
    filters: { search: '', category: null, tags: [] },
  }))
);

export const { selectAll, selectEntities, selectIds, selectTotal } =
  datasetsAdapter.getSelectors();
