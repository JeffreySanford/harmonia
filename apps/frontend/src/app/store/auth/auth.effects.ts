import {
  inject,
  Injectable,
  NgZone,
} from '@angular/core';
import {
  HttpErrorResponse,
} from '@angular/common/http';
import {
  Router,
} from '@angular/router';
import {
  Actions,
  createEffect,
  ofType,
} from '@ngrx/effects';
import {
  of,
} from 'rxjs';
import {
  catchError,
  map,
  mergeMap,
  tap,
} from 'rxjs/operators';
import {
  AuthService,
} from '../../services/auth.service';
import * as AuthActions from './auth.actions';

function authErrorMessage(
  error:
    HttpErrorResponse,
  fallback:
    string
): string {
  if (
    error.status ===
    0
  ) {
    return (
      'Network error: Unable to reach the server. ' +
      'Is backend running?'
    );
  }

  const apiMessage =
    error.error?.message;

  if (
    typeof apiMessage ===
    'string'
  ) {
    return apiMessage;
  }

  if (
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

function persistAccessSession(
  userJson:
    string,
  token:
    string
): void {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    window.localStorage
      .setItem(
        'auth_user',
        userJson
      );

    window.localStorage
      .setItem(
        'auth_token',
        token
      );

    window.localStorage
      .removeItem(
        'refresh_token'
      );
  } catch {
    // Ignore unavailable browser storage.
  }
}

function persistAccessToken(
  token:
    string
): void {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    window.localStorage
      .setItem(
        'auth_token',
        token
      );

    window.localStorage
      .removeItem(
        'refresh_token'
      );
  } catch {
    // Ignore unavailable browser storage.
  }
}

function persistUser(
  userJson:
    string
): void {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    window.localStorage
      .setItem(
        'auth_user',
        userJson
      );

    window.localStorage
      .removeItem(
        'refresh_token'
      );
  } catch {
    // Ignore unavailable browser storage.
  }
}

function clearBrowserAuthState():
  void {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  try {
    window.localStorage
      .removeItem(
        'auth_user'
      );

    window.localStorage
      .removeItem(
        'auth_token'
      );

    window.localStorage
      .removeItem(
        'refresh_token'
      );
  } catch {
    // Ignore unavailable browser storage.
  }
}

@Injectable()
export class AuthEffects {
  private readonly actions$ =
    inject(Actions);

  private readonly authService =
    inject(AuthService);

  private readonly router =
    inject(Router);

  private readonly ngZone =
    inject(NgZone);

  login$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.login
            ),

            mergeMap(
              (action) =>
                this.authService
                  .login({
                    emailOrUsername:
                      action.emailOrUsername,
                    password:
                      action.password,
                  })
                  .pipe(
                    map(
                      (response) =>
                        this.ngZone.run(
                          () =>
                            AuthActions
                              .loginSuccess({
                                user:
                                  response.user,
                                token:
                                  response.accessToken,
                              })
                        )
                    ),

                    catchError(
                      (
                        error:
                          HttpErrorResponse
                      ) =>
                        this.ngZone.run(
                          () =>
                            of(
                              AuthActions
                                .loginFailure({
                                  error:
                                    authErrorMessage(
                                      error,
                                      'Login failed'
                                    ),
                                })
                            )
                        )
                    )
                  )
            )
          ),
      {
        useEffectsErrorHandler:
          false,
      }
    );

  loginSuccess$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.loginSuccess
            ),

            tap(
              ({
                user,
                token,
              }) => {
                persistAccessSession(
                  JSON.stringify(
                    user
                  ),
                  token
                );

                this.ngZone.run(
                  () =>
                    this.router
                      .navigate([
                        '/library',
                      ])
                );
              }
            )
          ),
      {
        dispatch:
          false,
      }
    );

  register$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.register
            ),

            mergeMap(
              (action) =>
                this.authService
                  .register({
                    email:
                      action.email,
                    username:
                      action.username,
                    password:
                      action.password,
                  })
                  .pipe(
                    map(
                      (response) =>
                        this.ngZone.run(
                          () =>
                            AuthActions
                              .registerSuccess({
                                user:
                                  response.user,
                                token:
                                  response.accessToken,
                              })
                        )
                    ),

                    catchError(
                      (
                        error:
                          HttpErrorResponse
                      ) =>
                        this.ngZone.run(
                          () =>
                            of(
                              AuthActions
                                .registerFailure({
                                  error:
                                    authErrorMessage(
                                      error,
                                      'Registration failed'
                                    ),
                                })
                            )
                        )
                    )
                  )
            )
          )
    );

  registerSuccess$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.registerSuccess
            ),

            tap(
              ({
                user,
                token,
              }) => {
                persistAccessSession(
                  JSON.stringify(
                    user
                  ),
                  token
                );

                this.ngZone.run(
                  () =>
                    this.router
                      .navigate([
                        '/library',
                      ])
                );
              }
            )
          ),
      {
        dispatch:
          false,
      }
    );

  logout$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.logout
            ),

            mergeMap(
              () =>
                this.authService
                  .logout()
                  .pipe(
                    map(
                      () =>
                        this.ngZone.run(
                          () =>
                            AuthActions
                              .logoutSuccess()
                        )
                    ),

                    catchError(
                      () =>
                        this.ngZone.run(
                          () =>
                            of(
                              AuthActions
                                .logoutSuccess()
                            )
                        )
                    )
                  )
            )
          )
    );

  logoutSuccess$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.logoutSuccess
            ),

            tap(
              () => {
                clearBrowserAuthState();

                this.router
                  .navigate([
                    '/',
                  ]);
              }
            )
          ),
      {
        dispatch:
          false,
      }
    );

  refreshToken$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.refreshToken
            ),

            mergeMap(
              () =>
                this.authService
                  .refreshToken()
                  .pipe(
                    map(
                      (response) =>
                        this.ngZone.run(
                          () =>
                            AuthActions
                              .refreshTokenSuccess({
                                token:
                                  response.accessToken,
                              })
                        )
                    ),

                    catchError(
                      (
                        error:
                          HttpErrorResponse
                      ) =>
                        this.ngZone.run(
                          () =>
                            of(
                              AuthActions
                                .refreshTokenFailure({
                                  error:
                                    authErrorMessage(
                                      error,
                                      'Token refresh failed'
                                    ),
                                })
                            )
                        )
                    )
                  )
            )
          )
    );

  refreshTokenSuccess$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.refreshTokenSuccess
            ),

            tap(
              ({
                token,
              }) => {
                persistAccessToken(
                  token
                );
              }
            )
          ),
      {
        dispatch:
          false,
      }
    );

  sessionValidPersistence$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.sessionValid
            ),

            tap(
              ({
                user,
              }) => {
                persistUser(
                  JSON.stringify(
                    user
                  )
                );
              }
            )
          ),
      {
        dispatch:
          false,
      }
    );

  sessionInvalidPersistence$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.sessionInvalid
            ),

            tap(
              () => {
                clearBrowserAuthState();
              }
            )
          ),
      {
        dispatch:
          false,
      }
    );

  checkSession$ =
    createEffect(
      () =>
        this.actions$
          .pipe(
            ofType(
              AuthActions.checkSession
            ),

            mergeMap(
              () =>
                this.authService
                  .checkSession()
                  .pipe(
                    map(
                      (response) =>
                        this.ngZone.run(
                          () =>
                            AuthActions
                              .sessionValid({
                                user: {
                                  id:
                                    response.id,
                                  email:
                                    response.email,
                                  username:
                                    response.username,
                                  role:
                                    response.role,
                                  createdAt:
                                    new Date()
                                      .toISOString(),
                                },
                              })
                        )
                    ),

                    catchError(
                      () =>
                        this.ngZone.run(
                          () =>
                            of(
                              AuthActions
                                .sessionInvalid()
                            )
                        )
                    )
                  )
            )
          )
    );
}
