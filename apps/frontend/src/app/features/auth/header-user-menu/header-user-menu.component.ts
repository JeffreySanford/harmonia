import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as AuthSelectors from '../../../store/auth/auth.selectors';
import * as AuthActions from '../../../store/auth/auth.actions';
import { User } from '../../../store/auth/auth.state';

/**
 * Header User Menu Component
 * 
 * Dropdown menu for authenticated users with:
 * - User info display (username, email, role badge)
 * - Navigation links (My Library, Profile Settings)
 * - Admin Dashboard link (admin users only)
 * - Logout action
 * 
 * **Features**:
 * - Material Menu component with trigger button
 * - Conditional rendering based on user role
 * - NGRX integration for auth state
 * - Router navigation for menu items
 * - Auto-close on item selection
 * 
 * **User Roles**:
 * - `admin`: Full access including Admin Dashboard
 * - `user`: Standard access (Library, Profile)
 * - `guest`: Should not see this menu (render condition)
 * 
 * @selector harmonia-header-user-menu
 */
@Component({
  selector: 'harmonia-header-user-menu',
  templateUrl: './header-user-menu.component.html',
  styleUrls: ['./header-user-menu.component.scss'],
  standalone: false
})
export class HeaderUserMenuComponent {
  private store = inject(Store);
  private router = inject(Router);

  // Auth state observables
  user$: Observable<User | null> = this.store.select(AuthSelectors.selectUser);
  username$: Observable<string> = this.store.select(AuthSelectors.selectUsername);
  isAdmin$: Observable<boolean> = this.store.select(AuthSelectors.selectIsAdmin);

  /**
   * Navigate to user library
   */
  goToLibrary(): void {
    this.router.navigate(['/library']);
  }

  /**
   * Navigate to profile settings
   */
  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  /**
   * Navigate to admin dashboard (admin only)
   */
  goToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  /**
   * Logout user and redirect to home
   */
  logout(): void {
    this.store.dispatch(AuthActions.logout());
    this.router.navigate(['/']);
  }

  /**
   * Get role badge text
   */
  getRoleBadge(user: User | null): string {
    if (!user) return '';
    return user.role === 'admin' ? 'Admin' : 'User';
  }

  /**
   * Get role badge color class
   */
  getRoleBadgeClass(user: User | null): string {
    if (!user) return '';
    return user.role === 'admin' ? 'role-badge-admin' : 'role-badge-user';
  }
}
