/**
 * Route Guards Index
 * 
 * Centralized exports for all route guards.
 * 
 * **Available Guards**:
 * - `authGuard` - Protect authenticated routes
 * - `adminGuard` - Restrict admin-only routes
 * - `guestGuard` - Prevent authenticated users from guest pages
 * 
 * **Usage**:
 * ```typescript
 * import { authGuard, adminGuard } from './guards';
 * 
 * const routes: Route[] = [
 *   {
 *     path: 'library',
 *     canActivate: [authGuard],
 *     loadChildren: () => import('./features/library/library.module')
 *   },
 *   {
 *     path: 'admin',
 *     canActivate: [authGuard, adminGuard],
 *     loadChildren: () => import('./features/admin/admin.module')
 *   }
 * ];
 * ```
 */

export { authGuard } from './auth.guard';
export { adminGuard } from './admin.guard';
export { guestGuard } from './guest.guard';
