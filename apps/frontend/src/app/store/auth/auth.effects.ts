/**
 * Auth Effects
 * Handles authentication side effects and API calls
 */

import { Injectable, inject, NgZone } from '@angular/core';
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
  private readonly ngZone = inject(NgZone);

  login$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.login),
        mergeMap((action) =>
          this.authService
            .login({
              emailOrUsername: action.emailOrUsername,
              password: action.password,
            })
            .pipe(
              map((response) => {
                // Ensure action dispatch happens within NgZone
                return this.ngZone.run(() =>
                  AuthActions.loginSuccess({
                    user: response.user,
                    token: response.accessToken,
                    refreshToken: response.refreshToken,
                  })
                );
              }),
              catchError((error) => {
                // Map network failures to a clearer message for UI
                const message =
                  error?.status === 0
                    ? 'Network error: Unable to reach the server. Is backend running?'
                    : error?.error?.message || error.message || 'Login failed';
                // Ensure error action dispatch happens within NgZone
                return this.ngZone.run(() =>
                  of(AuthActions.loginFailure({ error: message }))
                );
              })
            )
        )
      ),
    { useEffectsErrorHandler: false }
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(({ token, refreshToken }) => {
          // Emit debug logs in development/test to help e2e debugging
          if (typeof window !== 'undefined') {
            try {
              const tokenInfo = token
                ? `${token.slice(0, 8)}...(${token.length})`
                : null;
              const refreshTokenInfo = refreshToken
                ? `${refreshToken.slice(0, 8)}...(${refreshToken.length})`
                : null;
              console.debug('[AuthEffects.loginSuccess] tokens:', {
                token: tokenInfo,
                refreshToken: refreshTokenInfo,
              });
            } catch (e) {
              // no-op for loggiP$sjkfhasdjfng
            }
          }
          try {
            if (token) {
              (window as any).localStorage.setItem('auth_token', token);
            }
            if (refreshToken) {
              (window as any).localStorage.setItem(
                'refresh_token',
                refreshToken
              );
            }
          } catch (e) {
            // ignore storage errors
          }
          // Confirm saved tokens exist in localStorage (for debug)
          if (typeof window !== 'undefined') {
            try {
              const savedToken = (window as any).localStorage.getItem(
                'auth_token'
              );
              const savedRefresh = (window as any).localStorage.getItem(
                'refresh_token'
              );
              console.debug('[AuthEffects.loginSuccess] saved tokens exist:', {
                savedToken: savedToken
                  ? `${savedToken.slice(0, 8)}...(${savedToken.length})`
                  : null,
                savedRefresh: savedRefresh
                  ? `${savedRefresh.slice(0, 8)}...(${savedRefresh.length})`
                  : null,
              });
            } catch (e) {
              // ignore
            }
          }
          // Instrument for E2E test visibility: indicate navigation call fired
          try {
            (window as any).localStorage.setItem(
              'e2e_login_navigation',
              Date.now().toString()
            );
          } catch (e) {
            // ignore
          }
          // Navigate within NgZone to ensure Angular performs change detection and route updates
          this.ngZone.run(() => this.router.navigate(['/library']));
        })
      ),
    { dispatch: false }
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.register),
      mergeMap((action) =>
        this.authService
          .register({
            email: action.email,
            username: action.username,
            password: action.password,
          })
          .pipe(
            map((response) => {
              return this.ngZone.run(() =>
                AuthActions.registerSuccess({
                  user: response.user,
                  token: response.accessToken,
                  refreshToken: response.refreshToken,
                })
              );
            }),
            catchError((error) => {
              return this.ngZone.run(() =>
                of(
                  AuthActions.registerFailure({
                    error:
                      error?.error?.message ||
                      error.message ||
                      'Registration failed',
                  })
                )
              );
            })
          )
      )
    )
  );

  registerSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.registerSuccess),
        tap(({ token, refreshToken }) => {
          if (typeof window !== 'undefined') {
            try {
              const tokenInfo = token
                ? `${token.slice(0, 8)}...(${token.length})`
                : null;
              const refreshTokenInfo = refreshToken
                ? `${refreshToken.slice(0, 8)}...(${refreshToken.length})`
                : null;
              console.debug('[AuthEffects.registerSuccess] tokens:', {
                token: tokenInfo,
                refreshToken: refreshTokenInfo,
              });
            } catch (e) {
              // no-op
            }
          }
          try {
            if (token) {
              (window as any).localStorage.setItem('auth_token', token);
            }
            if (refreshToken) {
              (window as any).localStorage.setItem(
                'refresh_token',
                refreshToken
              );
            }
          } catch (e) {
            // ignore storage errors
          }
          // Confirm saved tokens exist in localStorage (for debug)
          if (typeof window !== 'undefined') {
            try {
              const savedToken = (window as any).localStorage.getItem(
                'auth_token'
              );
              const savedRefresh = (window as any).localStorage.getItem(
                'refresh_token'
              );
              console.debug(
                '[AuthEffects.registerSuccess] saved tokens exist:',
                {
                  savedToken: savedToken
                    ? `${savedToken.slice(0, 8)}...(${savedToken.length})`
                    : null,
                  savedRefresh: savedRefresh
                    ? `${savedRefresh.slice(0, 8)}...(${savedRefresh.length})`
                    : null,
                }
              );
            } catch (e) {
              // ignore
            }
          }
          try {
            (window as any).localStorage.setItem(
              'e2e_register_navigation',
              Date.now().toString()
            );
              } catch (e) { /* ignore storage errors */ }
          this.ngZone.run(() => this.router.navigate(['/library']));
        })
      ),
    { dispatch: false }
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      mergeMap(() =>
        this.authService.logout().pipe(
          map(() => this.ngZone.run(() => AuthActions.logoutSuccess())),
          catchError(() =>
            this.ngZone.run(() => of(AuthActions.logoutSuccess()))
          )
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
          map((response) => {
            return this.ngZone.run(() =>
              AuthActions.refreshTokenSuccess({
                token: response.accessToken,
                refreshToken: response.refreshToken,
              })
            );
          }),
          catchError((error) => {
            return this.ngZone.run(() =>
              of(
                AuthActions.refreshTokenFailure({
                  error:
                    error?.error?.message ||
                    error.message ||
                    'Token refresh failed',
                })
              )
            );
          })
        )
      )
    )
  );

  checkSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.checkSession),
      mergeMap(() =>
        this.authService.checkSession().pipe(
          map((response) => {
            return this.ngZone.run(() =>
              AuthActions.sessionValid({
                user: {
                  id: response.id,
                  email: response.email,
                  username: response.username,
                  role: response.role as 'admin' | 'user' | 'guest',
                  createdAt: new Date().toISOString(),
                },
              })
            );
          }),
          catchError(() =>
            this.ngZone.run(() => of(AuthActions.sessionInvalid()))
          )
        )
      )
    )
  );
}
