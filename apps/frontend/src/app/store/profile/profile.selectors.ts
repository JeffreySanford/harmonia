import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProfileState } from './profile.state';

export const selectProfileState =
  createFeatureSelector<ProfileState>('profile');

export const selectProfile = createSelector(
  selectProfileState,
  (state) => state.profile
);

export const selectProfileLoading = createSelector(
  selectProfileState,
  (state) => state.loading
);

export const selectProfileError = createSelector(
  selectProfileState,
  (state) => state.error
);

export const selectProfileStats = createSelector(
  selectProfile,
  (profile) => profile?.stats
);

export const selectProfilePreferences = createSelector(
  selectProfile,
  (profile) => profile?.preferences
);
