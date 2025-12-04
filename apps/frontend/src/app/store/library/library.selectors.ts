import { createFeatureSelector, createSelector } from '@ngrx/store';
import { LibraryState } from './library.state';

export const selectLibraryState =
  createFeatureSelector<LibraryState>('library');

export const selectLibraryItems = createSelector(
  selectLibraryState,
  (state) => state.items
);

export const selectLibraryFilters = createSelector(
  selectLibraryState,
  (state) => state.filters
);

export const selectLibraryPagination = createSelector(
  selectLibraryState,
  (state) => state.pagination
);

export const selectLibraryLoading = createSelector(
  selectLibraryState,
  (state) => state.loading
);

export const selectLibraryError = createSelector(
  selectLibraryState,
  (state) => state.error
);

export const selectSelectedLibraryItem = createSelector(
  selectLibraryState,
  (state) => state.selectedItem
);

export const selectLibraryItemsByType = createSelector(
  selectLibraryItems,
  selectLibraryFilters,
  (items, filters) => {
    if (!filters.type || filters.type === 'all') {
      return items;
    }
    return items.filter((item) => item.type === filters.type);
  }
);

export const selectLibraryItemsBySearch = createSelector(
  selectLibraryItemsByType,
  selectLibraryFilters,
  (items, filters) => {
    if (!filters.search) {
      return items;
    }
    const searchTerm = filters.search.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(searchTerm) ||
        item.description?.toLowerCase().includes(searchTerm)
    );
  }
);
