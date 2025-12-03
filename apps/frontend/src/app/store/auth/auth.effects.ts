/**
 * Auth Effects
 * Handles authentication side effects and API calls
 */

import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import * as AuthActions from './auth.actions';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      mergeMap((action) =>
        this.authService.login(action).pipe(
          map((response) =>
            AuthActions.loginSuccess({
              user: response.user,
              token: response.accessToken,
              refreshToken: response.refreshToken,
            })
          ),
          catchError((error) =>
            of(
              AuthActions.loginFailure({
                error: error?.error?.message || error.message || 'Login failed',
              })
            )
          )
        )
      )
    )
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(() => {
          this.router.navigate(['/library']);
        })
      ),
    { dispatch: false }
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.register),
      mergeMap((action) =>
        this.authService.register(action).pipe(
          map((response) =>
            AuthActions.registerSuccess({
              user: response.user,
              token: response.accessToken,
              refreshToken: response.refreshToken,
            })
          ),
          catchError((error) =>
            of(
              AuthActions.registerFailure({
                error: error?.error?.message || error.message || 'Registration failed',
              })
            )
          )
        )
      )
    )
  );

  registerSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.registerSuccess),
        tap(() => {
          this.router.navigate(['/library']);
        })
      ),
    { dispatch: false }
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      mergeMap(() =>
        this.authService.logout().pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError(() => of(AuthActions.logoutSuccess()))
        )
      )
    )
  );

  logoutSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutSuccess),
        tap(() => {
          this.router.navigate(['/']);
        })
      ),
    { dispatch: false }
  );

  refreshToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshToken),
      mergeMap(() =>
        this.authService.refreshToken().pipe(
          map((response) =>
            AuthActions.refreshTokenSuccess({
              token: response.accessToken,
              refreshToken: response.refreshToken,
            })
          ),
          catchError((error) =>
            of(
              AuthActions.refreshTokenFailure({
                error: error?.error?.message || error.message || 'Token refresh failed',
              })
            )
          )
        )
      )
    )
  );

  checkSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.checkSession),
      mergeMap(() =>
        this.authService.checkSession().pipe(
          map((response) =>
            AuthActions.sessionValid({ 
              user: {
                id: response.id,
                email: response.email,
                username: response.username,
                role: response.role as 'admin' | 'user' | 'guest',
                createdAt: new Date().toISOString()
              }
            })
          ),
          catchError(() => of(AuthActions.sessionInvalid()))
        )
      )
    )
  );
}
