/**
 * Models Reducer
 */

import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { ModelArtifact, ModelsState } from './models.state';
import * as ModelsActions from './models.actions';

export const modelsAdapter: EntityAdapter<ModelArtifact> =
  createEntityAdapter<ModelArtifact>({
    selectId: (model) => model.id,
    sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
  });

export const initialModelsState: ModelsState = modelsAdapter.getInitialState({
  selectedModelId: null,
  loading: false,
  error: null,
  filters: {
    search: '',
    modelType: null,
    tags: [],
  },
});

export const modelsReducer = createReducer(
  initialModelsState,
  on(ModelsActions.loadModels, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(ModelsActions.loadModelsSuccess, (state, { models }) =>
    modelsAdapter.setAll(models, { ...state, loading: false })
  ),
  on(ModelsActions.loadModelsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ModelsActions.loadModel, (state) => ({ ...state, loading: true })),
  on(ModelsActions.loadModelSuccess, (state, { model }) =>
    modelsAdapter.upsertOne(model, { ...state, loading: false })
  ),
  on(ModelsActions.loadModelFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ModelsActions.selectModel, (state, { id }) => ({
    ...state,
    selectedModelId: id,
  })),
  on(ModelsActions.deselectModel, (state) => ({
    ...state,
    selectedModelId: null,
  })),
  on(ModelsActions.createModel, (state) => ({ ...state, loading: true })),
  on(ModelsActions.createModelSuccess, (state, { model }) =>
    modelsAdapter.addOne(model, { ...state, loading: false })
  ),
  on(ModelsActions.createModelFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ModelsActions.updateModel, (state) => ({ ...state, loading: true })),
  on(ModelsActions.updateModelSuccess, (state, { model }) =>
    modelsAdapter.upsertOne(model, { ...state, loading: false })
  ),
  on(ModelsActions.updateModelFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ModelsActions.deleteModel, (state) => ({ ...state, loading: true })),
  on(ModelsActions.deleteModelSuccess, (state, { id }) =>
    modelsAdapter.removeOne(id, {
      ...state,
      loading: false,
      selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
    })
  ),
  on(ModelsActions.deleteModelFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),
  on(ModelsActions.setSearchFilter, (state, { search }) => ({
    ...state,
    filters: { ...state.filters, search },
  })),
  on(ModelsActions.setModelTypeFilter, (state, { modelType }) => ({
    ...state,
    filters: { ...state.filters, modelType },
  })),
  on(ModelsActions.setTagsFilter, (state, { tags }) => ({
    ...state,
    filters: { ...state.filters, tags },
  })),
  on(ModelsActions.clearFilters, (state) => ({
    ...state,
    filters: { search: '', modelType: null, tags: [] },
  }))
);

export const { selectAll, selectEntities, selectIds, selectTotal } =
  modelsAdapter.getSelectors();
