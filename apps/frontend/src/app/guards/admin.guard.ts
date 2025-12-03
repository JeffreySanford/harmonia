import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs/operators';
import * as AuthSelectors from '../store/auth/auth.selectors';

/**
 * Admin Guard
 * 
 * Restricts access to admin-only routes.
 * Requires user to be authenticated AND have admin role.
 * Redirects to home page if user is not an admin.
 * 
 * **Usage**:
 * ```typescript
 * {
 *   path: 'admin',
 *   canActivate: [authGuard, adminGuard],
 *   loadChildren: () => import('./features/admin/admin.module')
 * }
 * ```
 * 
 * **Flow**:
 * 1. Check if user has admin role in NGRX store
 * 2. If admin → Allow access
 * 3. If not admin → Redirect to home page
 * 
 * **Note**: Should be used together with `authGuard` to ensure authentication first.
 * 
 * @see {@link file://./docs/AUTHENTICATION_SYSTEM.md} for architecture
 */
export const adminGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.select(AuthSelectors.selectIsAdmin).pipe(
    take(1),
    map(isAdmin => {
      if (isAdmin) {
        return true;
      }
      
      // Redirect to home page if not admin
      router.navigate(['/']);
      return false;
    })
  );
};
