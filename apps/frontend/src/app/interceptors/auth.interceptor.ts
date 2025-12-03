import { inject, Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import * as AuthSelectors from '../store/auth/auth.selectors';
import * as AuthActions from '../store/auth/auth.actions';

/**
 * Auth Interceptor
 * 
 * Automatically attaches JWT token to outgoing HTTP requests.
 * Handles 401 Unauthorized responses by attempting token refresh.
 * 
 * **Features**:
 * - Adds Authorization header with JWT token
 * - Intercepts 401 responses
 * - Attempts token refresh on auth failure
 * - Redirects to login on refresh failure
 * 
 * **Request Flow**:
 * 1. Get token from NGRX store
 * 2. Clone request and add Authorization header
 * 3. Send request with token
 * 
 * **Error Flow**:
 * 1. Catch 401 Unauthorized response
 * 2. Dispatch token refresh action
 * 3. If refresh fails → Logout and redirect to home
 * 
 * **Excluded Endpoints**:
 * - `/auth/login` - Initial authentication
 * - `/auth/register` - User registration
 * - `/auth/refresh` - Token refresh (to avoid infinite loop)
 * 
 * @see {@link file://./docs/AUTHENTICATION_SYSTEM.md} for architecture
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private store = inject(Store);
  private router = inject(Router);

  /**
   * Intercept HTTP requests and add authentication token
   */
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip auth header for login, register, and refresh endpoints
    if (this.isAuthEndpoint(request.url)) {
      return next.handle(request);
    }

    // Get token from store and add to request
    return this.store.select(AuthSelectors.selectAuthToken).pipe(
      take(1),
      switchMap(token => {
        // Clone request and add Authorization header if token exists
        const authRequest = token
          ? request.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            })
          : request;

        // Send request and handle errors
        return next.handle(authRequest).pipe(
          catchError((error: HttpErrorResponse) => {
            // Only logout on 401 if we had a token (user was authenticated)
            if (error.status === 401 && token) {
              // Token expired or invalid - logout and redirect
              this.store.dispatch(AuthActions.logout());
              this.router.navigate(['/']);
            }
            return throwError(() => error);
          })
        );
      })
    );
  }

  /**
   * Check if endpoint should skip auth header
   */
  private isAuthEndpoint(url: string): boolean {
    const authEndpoints = ['/auth/login', '/auth/register', '/auth/refresh'];
    return authEndpoints.some(endpoint => url.includes(endpoint));
  }
}
