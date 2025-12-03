import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AuthUiService } from './services/auth-ui.service';
import * as AuthSelectors from './store/auth/auth.selectors';
import * as AuthActions from './store/auth/auth.actions';
import { User } from './store/auth/auth.state';

@Component({
  selector: 'harmonia-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private authUiService = inject(AuthUiService);
  private store = inject(Store);

  protected title = 'frontend';
  
  // Auth observables
  isAuthenticated$: Observable<boolean>;
  user$: Observable<User | null>;
  username$: Observable<string>;

  constructor() {
    this.isAuthenticated$ = this.store.select(AuthSelectors.selectIsAuthenticated);
    this.user$ = this.store.select(AuthSelectors.selectUser);
    this.username$ = this.store.select(AuthSelectors.selectUsername);
  }

  ngOnInit(): void {
    // Check for existing session on app load
    this.store.dispatch(AuthActions.checkSession());
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
