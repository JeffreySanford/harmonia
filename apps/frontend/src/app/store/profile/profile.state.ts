import { createAction, createReducer, on, props } from '@ngrx/store';
import { UserProfile } from '../../services/profile.service';

// State
export interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export const initialProfileState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
};

// Actions
export const loadProfile = createAction('[Profile] Load Profile');

export const loadProfileSuccess = createAction(
  '[Profile] Load Profile Success',
  props<{ profile: UserProfile }>()
);

export const loadProfileFailure = createAction(
  '[Profile] Load Profile Failure',
  props<{ error: string }>()
);

export const updateProfile = createAction(
  '[Profile] Update Profile',
  props<{ profile: Partial<UserProfile> }>()
);

export const updateProfileSuccess = createAction(
  '[Profile] Update Profile Success',
  props<{ profile: UserProfile }>()
);

export const updateProfileFailure = createAction(
  '[Profile] Update Profile Failure',
  props<{ error: string }>()
);

export const changePassword = createAction(
  '[Profile] Change Password',
  props<{ currentPassword: string; newPassword: string }>()
);

export const changePasswordSuccess = createAction(
  '[Profile] Change Password Success',
  props<{ message: string }>()
);

export const changePasswordFailure = createAction(
  '[Profile] Change Password Failure',
  props<{ error: string }>()
);

export const uploadAvatar = createAction(
  '[Profile] Upload Avatar',
  props<{ avatar: File }>()
);

export const uploadAvatarSuccess = createAction(
  '[Profile] Upload Avatar Success',
  props<{ profile: UserProfile }>()
);

export const uploadAvatarFailure = createAction(
  '[Profile] Upload Avatar Failure',
  props<{ error: string }>()
);

export const deleteAccount = createAction('[Profile] Delete Account');

export const deleteAccountSuccess = createAction(
  '[Profile] Delete Account Success',
  props<{ message: string }>()
);

export const deleteAccountFailure = createAction(
  '[Profile] Delete Account Failure',
  props<{ error: string }>()
);

export const clearError = createAction('[Profile] Clear Error');

// Reducer
export const profileReducer = createReducer(
  initialProfileState,

  on(loadProfile, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(loadProfileSuccess, (state, { profile }) => ({
    ...state,
    profile,
    loading: false,
  })),

  on(loadProfileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(updateProfile, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(updateProfileSuccess, (state, { profile }) => ({
    ...state,
    profile,
    loading: false,
  })),

  on(updateProfileFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(changePassword, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(changePasswordSuccess, (state) => ({
    ...state,
    loading: false,
  })),

  on(changePasswordFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(uploadAvatar, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(uploadAvatarSuccess, (state, { profile }) => ({
    ...state,
    profile,
    loading: false,
  })),

  on(uploadAvatarFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(deleteAccount, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(deleteAccountSuccess, (state) => ({
    ...state,
    loading: false,
  })),

  on(deleteAccountFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(clearError, (state) => ({
    ...state,
    error: null,
  }))
);
