import {
  createAction,
  props,
} from '@ngrx/store';
import {
  User,
} from './auth.state';

export const login =
  createAction(
    '[Auth] Login',
    props<{
      emailOrUsername:
        string;
      password:
        string;
    }>()
  );

export const loginSuccess =
  createAction(
    '[Auth] Login Success',
    props<{
      user:
        User;
      token:
        string;
    }>()
  );

export const loginFailure =
  createAction(
    '[Auth] Login Failure',
    props<{
      error:
        string;
    }>()
  );

export const register =
  createAction(
    '[Auth] Register',
    props<{
      email:
        string;
      username:
        string;
      password:
        string;
    }>()
  );

export const registerSuccess =
  createAction(
    '[Auth] Register Success',
    props<{
      user:
        User;
      token:
        string;
    }>()
  );

export const registerFailure =
  createAction(
    '[Auth] Register Failure',
    props<{
      error:
        string;
    }>()
  );

export const logout =
  createAction(
    '[Auth] Logout'
  );

export const logoutSuccess =
  createAction(
    '[Auth] Logout Success'
  );

export const refreshToken =
  createAction(
    '[Auth] Refresh Token'
  );

export const refreshTokenSuccess =
  createAction(
    '[Auth] Refresh Token Success',
    props<{
      token:
        string;
    }>()
  );

export const refreshTokenFailure =
  createAction(
    '[Auth] Refresh Token Failure',
    props<{
      error:
        string;
    }>()
  );

export const checkSession =
  createAction(
    '[Auth] Check Session'
  );

export const sessionValid =
  createAction(
    '[Auth] Session Valid',
    props<{
      user:
        User;
    }>()
  );

export const sessionInvalid =
  createAction(
    '[Auth] Session Invalid'
  );
