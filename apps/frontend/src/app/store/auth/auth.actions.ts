/**
 * Auth Actions
 * Actions for authentication flows (login, register, logout, token refresh)
 */

import { createAction, props } from '@ngrx/store';
import { User } from './auth.state';

// Login actions
export const login = createAction(
  '[Auth] Login',
  props<{ emailOrUsername: string; password: string }>()
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: User; token: string; refreshToken: string }>()
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);

// Register actions
export const register = createAction(
  '[Auth] Register',
  props<{ email: string; username: string; password: string }>()
);

export const registerSuccess = createAction(
  '[Auth] Register Success',
  props<{ user: User; token: string; refreshToken: string }>()
);

export const registerFailure = createAction(
  '[Auth] Register Failure',
  props<{ error: string }>()
);

// Logout actions
export const logout = createAction('[Auth] Logout');

export const logoutSuccess = createAction('[Auth] Logout Success');

// Token refresh actions
export const refreshToken = createAction('[Auth] Refresh Token');

export const refreshTokenSuccess = createAction(
  '[Auth] Refresh Token Success',
  props<{ token: string; refreshToken: string }>()
);

export const refreshTokenFailure = createAction(
  '[Auth] Refresh Token Failure',
  props<{ error: string }>()
);

// Session check
export const checkSession = createAction('[Auth] Check Session');

export const sessionValid = createAction(
  '[Auth] Session Valid',
  props<{ user: User }>()
);

export const sessionInvalid = createAction('[Auth] Session Invalid');
