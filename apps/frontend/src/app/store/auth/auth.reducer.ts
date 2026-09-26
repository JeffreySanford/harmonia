import {
  createReducer,
  on,
} from '@ngrx/store';
import {
  initialAuthState,
} from './auth.state';
import type {
  AuthState,
} from './auth.state';
import * as AuthActions from './auth.actions';

const createGuestAuthState =
  (): AuthState => ({
    user:
      null,
    token:
      null,
    isAuthenticated:
      false,
    loading:
      false,
    error:
      null,
  });

export const authReducer =
  createReducer(
    initialAuthState,

    on(
      AuthActions.login,
      (state) => ({
        ...state,
        loading:
          true,
        error:
          null,
      })
    ),

    on(
      AuthActions.loginSuccess,
      (
        state,
        {
          user,
          token,
        }
      ) => ({
        ...state,
        user,
        token,
        isAuthenticated:
          true,
        loading:
          false,
        error:
          null,
      })
    ),

    on(
      AuthActions.loginFailure,
      (
        state,
        {
          error,
        }
      ) => ({
        ...state,
        loading:
          false,
        error,
      })
    ),

    on(
      AuthActions.register,
      (state) => ({
        ...state,
        loading:
          true,
        error:
          null,
      })
    ),

    on(
      AuthActions.registerSuccess,
      (
        state,
        {
          user,
          token,
        }
      ) => ({
        ...state,
        user,
        token,
        isAuthenticated:
          true,
        loading:
          false,
        error:
          null,
      })
    ),

    on(
      AuthActions.registerFailure,
      (
        state,
        {
          error,
        }
      ) => ({
        ...state,
        loading:
          false,
        error,
      })
    ),

    on(
      AuthActions.logout,
      (state) => ({
        ...state,
        loading:
          true,
      })
    ),

    on(
      AuthActions.logoutSuccess,
      () =>
        createGuestAuthState()
    ),

    on(
      AuthActions.refreshToken,
      (state) => ({
        ...state,
        loading:
          true,
      })
    ),

    on(
      AuthActions.refreshTokenSuccess,
      (
        state,
        {
          token,
        }
      ) => ({
        ...state,
        token,
        loading:
          false,
        error:
          null,
      })
    ),

    on(
      AuthActions.refreshTokenFailure,
      (
        state,
        {
          error,
        }
      ) => ({
        ...state,
        loading:
          false,
        error,
      })
    ),

    on(
      AuthActions.checkSession,
      (state) => ({
        ...state,
        loading:
          true,
      })
    ),

    on(
      AuthActions.sessionValid,
      (
        state,
        {
          user,
        }
      ) => ({
        ...state,
        user,
        isAuthenticated:
          true,
        loading:
          false,
        error:
          null,
      })
    ),

    on(
      AuthActions.sessionInvalid,
      () =>
        createGuestAuthState()
    )
  );
