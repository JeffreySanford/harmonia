import { createAction, createReducer, on, props } from '@ngrx/store';
import {
  LibraryItem,
  LibraryFilters,
  LibraryResponse,
} from '../../services/library.service';

// State
export interface LibraryState {
  items: LibraryItem[];
  filters: LibraryFilters;
  pagination: {
    currentPage: number;
    totalPages: number;
    total: number;
    pageSize: number;
  };
  loading: boolean;
  error: string | null;
  selectedItem: LibraryItem | null;
}

export const initialLibraryState: LibraryState = {
  items: [],
  filters: {},
  pagination: {
    currentPage: 1,
    totalPages: 0,
    total: 0,
    pageSize: 20,
  },
  loading: false,
  error: null,
  selectedItem: null,
};

// Actions
export const loadLibrary = createAction(
  '[Library] Load Library',
  props<{ filters?: LibraryFilters; page?: number }>()
);

export const loadLibrarySuccess = createAction(
  '[Library] Load Library Success',
  props<{ response: LibraryResponse }>()
);

export const loadLibraryFailure = createAction(
  '[Library] Load Library Failure',
  props<{ error: string }>()
);

export const loadLibraryItem = createAction(
  '[Library] Load Library Item',
  props<{ id: string }>()
);

export const loadLibraryItemSuccess = createAction(
  '[Library] Load Library Item Success',
  props<{ item: LibraryItem }>()
);

export const loadLibraryItemFailure = createAction(
  '[Library] Load Library Item Failure',
  props<{ error: string }>()
);

export const createLibraryItem = createAction(
  '[Library] Create Library Item',
  props<{ item: any }>()
);

export const createLibraryItemSuccess = createAction(
  '[Library] Create Library Item Success',
  props<{ item: LibraryItem }>()
);

export const createLibraryItemFailure = createAction(
  '[Library] Create Library Item Failure',
  props<{ error: string }>()
);

export const updateLibraryItem = createAction(
  '[Library] Update Library Item',
  props<{ id: string; item: any }>()
);

export const updateLibraryItemSuccess = createAction(
  '[Library] Update Library Item Success',
  props<{ item: LibraryItem }>()
);

export const updateLibraryItemFailure = createAction(
  '[Library] Update Library Item Failure',
  props<{ error: string }>()
);

export const deleteLibraryItem = createAction(
  '[Library] Delete Library Item',
  props<{ id: string }>()
);

export const deleteLibraryItemSuccess = createAction(
  '[Library] Delete Library Item Success',
  props<{ id: string }>()
);

export const deleteLibraryItemFailure = createAction(
  '[Library] Delete Library Item Failure',
  props<{ error: string }>()
);

export const uploadFile = createAction(
  '[Library] Upload File',
  props<{ file: File; itemType: string; title: string; description?: string }>()
);

export const uploadFileSuccess = createAction(
  '[Library] Upload File Success',
  props<{ item: LibraryItem }>()
);

export const uploadFileFailure = createAction(
  '[Library] Upload File Failure',
  props<{ error: string }>()
);

export const setFilters = createAction(
  '[Library] Set Filters',
  props<{ filters: LibraryFilters }>()
);

export const clearError = createAction('[Library] Clear Error');

// Reducer
export const libraryReducer = createReducer(
  initialLibraryState,

  on(loadLibrary, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(loadLibrarySuccess, (state, { response }) => ({
    ...state,
    items: response.items,
    pagination: {
      currentPage: response.page,
      totalPages: response.totalPages,
      total: response.total,
      pageSize: response.pageSize,
    },
    loading: false,
  })),

  on(loadLibraryFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(loadLibraryItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(loadLibraryItemSuccess, (state, { item }) => ({
    ...state,
    selectedItem: item,
    loading: false,
  })),

  on(loadLibraryItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(createLibraryItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(createLibraryItemSuccess, (state, { item }) => ({
    ...state,
    items: [item, ...state.items],
    loading: false,
  })),

  on(createLibraryItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(updateLibraryItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(updateLibraryItemSuccess, (state, { item }) => ({
    ...state,
    items: state.items.map((i) => (i.id === item.id ? item : i)),
    selectedItem:
      state.selectedItem?.id === item.id ? item : state.selectedItem,
    loading: false,
  })),

  on(updateLibraryItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(deleteLibraryItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(deleteLibraryItemSuccess, (state, { id }) => ({
    ...state,
    items: state.items.filter((i) => i.id !== id),
    selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    loading: false,
  })),

  on(deleteLibraryItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(uploadFile, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(uploadFileSuccess, (state, { item }) => ({
    ...state,
    items: [item, ...state.items],
    loading: false,
  })),

  on(uploadFileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(setFilters, (state, { filters }) => ({
    ...state,
    filters,
  })),

  on(clearError, (state) => ({
    ...state,
    error: null,
  }))
);
