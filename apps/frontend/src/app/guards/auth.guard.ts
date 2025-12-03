import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import * as AuthSelectors from '../store/auth/auth.selectors';

/**
 * Auth Guard
 * 
 * Prevents unauthenticated users from accessing protected routes.
 * Redirects to home page if user is not authenticated.
 * 
 * **Usage**:
 * ```typescript
 * {
 *   path: 'library',
 *   canActivate: [authGuard],
 *   loadChildren: () => import('./features/library/library.module')
 * }
 * ```
 * 
 * **Flow**:
 * 1. Check if user is authenticated in NGRX store
 * 2. If authenticated → Allow access
 * 3. If not authenticated → Redirect to home page
 * 
 * @see {@link file://./docs/AUTHENTICATION_SYSTEM.md} for architecture
 */
export const authGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.select(AuthSelectors.selectIsAuthenticated).pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      }
      
      // Redirect to home page
      router.navigate(['/']);
      return false;
    })
  );
};
