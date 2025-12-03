import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import * as AuthSelectors from '../store/auth/auth.selectors';

/**
 * Guest Guard
 * 
 * Prevents authenticated users from accessing guest-only routes (login, register).
 * Redirects to library if user is already authenticated.
 * 
 * **Usage**:
 * ```typescript
 * {
 *   path: 'login',
 *   canActivate: [guestGuard],
 *   component: LoginPageComponent
 * }
 * ```
 * 
 * **Flow**:
 * 1. Check if user is authenticated in NGRX store
 * 2. If NOT authenticated → Allow access (guest)
 * 3. If authenticated → Redirect to library page
 * 
 * **Use Cases**:
 * - Login page
 * - Registration page
 * - Password reset page
 * - Landing pages for unauthenticated users
 * 
 * @see {@link file://./docs/AUTHENTICATION_SYSTEM.md} for architecture
 */
export const guestGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.select(AuthSelectors.selectIsAuthenticated).pipe(
    take(1),
    map(isAuthenticated => {
      if (!isAuthenticated) {
        return true;
      }
      
      // Redirect to library if already authenticated
      router.navigate(['/library']);
      return false;
    })
  );
};
