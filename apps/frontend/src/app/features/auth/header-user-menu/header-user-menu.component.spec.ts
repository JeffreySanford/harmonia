/* eslint-disable max-lines-per-function */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { HeaderUserMenuComponent } from './header-user-menu.component';
import { AuthUiService } from '../../../services/auth-ui.service';
import { AuthMaterialModule } from '../../auth/auth-material.module';
import * as AuthActions from '../../../store/auth/auth.actions';
import * as AuthSelectors from '../../../store/auth/auth.selectors';
import { User } from '../../../store/auth/auth.state';

describe('HeaderUserMenuComponent', () => {
  let component: HeaderUserMenuComponent;
  let fixture: ComponentFixture<HeaderUserMenuComponent>;
  let store: MockStore;
  let router: jasmine.SpyObj<Router>;
  let authUiService: jasmine.SpyObj<AuthUiService>;

  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    createdAt: '2025-01-01T00:00:00Z',
  };

  const mockAdminUser: User = {
    ...mockUser,
    role: 'admin',
  };

  beforeEach(async () => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const authUiServiceSpy = jasmine.createSpyObj('AuthUiService', [
      'openLoginModal',
      'openRegisterModal',
      'closeAllDialogs',
    ]);

    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        AuthMaterialModule,
        HttpClientTestingModule,
      ],
      declarations: [HeaderUserMenuComponent],
      providers: [
        provideMockStore({
          selectors: [
            { selector: AuthSelectors.selectUser, value: mockUser },
            { selector: AuthSelectors.selectUsername, value: 'testuser' },
            { selector: AuthSelectors.selectIsAdmin, value: false },
            { selector: AuthSelectors.selectIsAuthenticated, value: true },
          ],
        }),
        { provide: AuthUiService, useValue: authUiServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    authUiService = TestBed.inject(
      AuthUiService
    ) as jasmine.SpyObj<AuthUiService>;
    fixture = TestBed.createComponent(HeaderUserMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user information', (done) => {
    component.user$.subscribe((user) => {
      expect(user).toEqual(mockUser);
      done();
    });
  });

  it('should navigate to library', () => {
    component.goToLibrary();
    expect(router.navigate).toHaveBeenCalledWith(['/library']);
  });

  it('should navigate to profile', () => {
    component.goToProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('should navigate to admin dashboard', () => {
    component.goToAdmin();
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('should dispatch logout action and navigate home', () => {
    const dispatchSpy = spyOn(store, 'dispatch');

    component.logout();

    expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.logout());
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should return correct role badge for user', () => {
    expect(component.getRoleBadge(mockUser)).toBe('User');
  });

  it('should return correct role badge for admin', () => {
    expect(component.getRoleBadge(mockAdminUser)).toBe('Admin');
  });

  it('should return empty string for null user', () => {
    expect(component.getRoleBadge(null)).toBe('');
  });

  it('should return correct role badge class for user', () => {
    expect(component.getRoleBadgeClass(mockUser)).toBe('role-badge-user');
  });

  it('should return correct role badge class for admin', () => {
    expect(component.getRoleBadgeClass(mockAdminUser)).toBe('role-badge-admin');
  });

  it('should return empty string class for null user', () => {
    expect(component.getRoleBadgeClass(null)).toBe('');
  });

  it('should show admin menu item for admin users', () => {
    store.overrideSelector(AuthSelectors.selectUser, mockAdminUser);
    store.overrideSelector(AuthSelectors.selectIsAdmin, true);
    store.refreshState();
    fixture.detectChanges();

    // Note: Material menu items are rendered in overlay, so this test verifies component logic
    component.isAdmin$.subscribe((isAdmin) => {
      expect(isAdmin).toBe(true);
    });
  });

  it('should treat null user as guest and return avatar-guest class', () => {
    // Simulate guest state
    store.overrideSelector(AuthSelectors.selectUser, null as unknown as User);
    store.overrideSelector(AuthSelectors.selectIsAuthenticated, false);
    store.refreshState();
    fixture.detectChanges();

    expect(component.getAvatarClass(null)).toBe('avatar-guest');
  });

  it('should call authUiService when opening login modal as guest', () => {
    authUiService.openLoginModal.and.returnValue({
      afterClosed: () => ({}),
    } as any);
    component.openLoginModal();
    expect(authUiService.openLoginModal).toHaveBeenCalledWith('login');
  });

  it('should render the menu trigger button', () => {
    const button = fixture.nativeElement.querySelector(
      'button.user-menu-trigger'
    );
    expect(button).toBeTruthy();
  });

  it('should not show admin menu item for regular users', () => {
    store.overrideSelector(AuthSelectors.selectIsAdmin, false);
    store.refreshState();
    fixture.detectChanges();

    component.isAdmin$.subscribe((isAdmin) => {
      expect(isAdmin).toBe(false);
    });
  });
});
