import { Component, OnInit, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { distinctUntilChanged, pairwise } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthUiService } from './services/auth-ui.service';
import * as AuthSelectors from './store/auth/auth.selectors';
import * as AuthActions from './store/auth/auth.actions';
import { User } from './store/auth/auth.state';
// Header menu and material modules are provided by `AuthModule` and `AppModule`.

@Component({
  selector: 'harmonia-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  // Module-based bootstrapping uses `AppModule`, which provides required modules.
  // Keep component decorator minimal since `App` is declared in `AppModule`.
})
export class App implements OnInit {
  private authUiService = inject(AuthUiService);
  private store = inject(Store);
  private ngZone = inject(NgZone);
  private router = inject(Router);

  protected title = 'frontend';

  // Auth observables
  isAuthenticated$: Observable<boolean>;
  user$: Observable<User | null>;
  username$: Observable<string>;
  isAdmin$: Observable<boolean>;

  constructor() {
    this.isAuthenticated$ = this.store.select(
      AuthSelectors.selectIsAuthenticated
    );
    this.user$ = this.store.select(AuthSelectors.selectUser);
    this.username$ = this.store.select(AuthSelectors.selectUsername);
    this.isAdmin$ = this.store.select(AuthSelectors.selectIsAdmin);
  }

  ngOnInit(): void {
    // Only check for existing session if we have a token
    this.store
      .select(AuthSelectors.selectAuthToken)
      .pipe(take(1))
      .subscribe((token) => {
        if (token) {
          // Ensure action dispatch happens within NgZone
          this.ngZone.run(() => {
            this.store.dispatch(AuthActions.checkSession());
          });
        }
      });

    // If we load the app and the user is not authenticated, but is on a protected route
    this.store
      .select(AuthSelectors.selectIsAuthenticated)
      .pipe(take(1))
      .subscribe((isAuth) => {
        if (!isAuth) {
          const url = this.router.url;
          const protectedPaths = ['/library', '/profile', '/admin'];
          if (protectedPaths.some((p) => url.startsWith(p))) {
            this.ngZone.run(() => this.router.navigate(['/']));
          }
        }
      });

    // Redirect to landing page when user is logged out and on a protected route
    this.store
      .select(AuthSelectors.selectIsAuthenticated)
      .pipe(distinctUntilChanged(), pairwise())
      .subscribe(([prev, current]) => {
        if (prev && !current) {
          const url = this.router.url;
          // Map of protected paths that require auth
          const protectedPaths = ['/library', '/profile', '/admin'];
          const inProtected = protectedPaths.some((p) => url.startsWith(p));
          if (inProtected) {
            this.ngZone.run(() => this.router.navigate(['/']));
          }
        }
      });
  }

  /**
   * Open login modal
   */
  openLogin(): void {
    this.authUiService.openLoginModal('login');
  }

  /**
   * Open register modal
   */
  openRegister(): void {
    this.authUiService.openRegisterModal();
  }
}
