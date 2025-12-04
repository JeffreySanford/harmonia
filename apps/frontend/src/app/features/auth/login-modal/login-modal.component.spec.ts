/* eslint-disable max-lines-per-function */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthMaterialModule } from '../../auth/auth-material.module';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { LoginModalComponent } from './login-modal.component';
import * as AuthActions from '../../../store/auth/auth.actions';
import * as AuthSelectors from '../../../store/auth/auth.selectors';

describe('LoginModalComponent', () => {
  let component: LoginModalComponent;
  let fixture: ComponentFixture<LoginModalComponent>;
  let store: MockStore;
  let dialogRef: jasmine.SpyObj<MatDialogRef<LoginModalComponent>>;

  const initialState = {
    auth: {
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    },
  };

  beforeEach(async () => {
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      declarations: [LoginModalComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        AuthMaterialModule,
        HttpClientTestingModule,
      ],
      providers: [
        provideMockStore({ initialState }),
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    dialogRef = TestBed.inject(MatDialogRef) as jasmine.SpyObj<
      MatDialogRef<LoginModalComponent>
    >;
    fixture = TestBed.createComponent(LoginModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with login mode', () => {
    expect(component.mode).toBe('login');
  });

  it('should initialize forms with validators', () => {
    expect(component.loginForm.get('emailOrUsername')).toBeDefined();
    expect(component.loginForm.get('password')).toBeDefined();
    expect(component.registerForm.get('email')).toBeDefined();
    expect(component.registerForm.get('username')).toBeDefined();
    expect(component.registerForm.get('password')).toBeDefined();
  });

  it('should toggle between login and register modes', () => {
    expect(component.mode).toBe('login');
    component.toggleMode();
    expect(component.mode).toBe('register');
    component.toggleMode();
    expect(component.mode).toBe('login');
  });

  it('should dispatch login action on valid login form submit', () => {
    const dispatchSpy = spyOn(store, 'dispatch');
    component.loginForm.setValue({
      emailOrUsername: 'test@example.com',
      password: 'password123',
    });

    component.onLogin();

    expect(dispatchSpy).toHaveBeenCalledWith(
      AuthActions.login({
        emailOrUsername: 'test@example.com',
        password: 'password123',
      })
    );
  });

  it('should dispatch register action on valid register form submit', () => {
    const dispatchSpy = spyOn(store, 'dispatch');
    component.registerForm.setValue({
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    });

    component.onRegister();

    expect(dispatchSpy).toHaveBeenCalledWith(
      AuthActions.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      })
    );
  });

  it('should not dispatch login action on invalid form', () => {
    const dispatchSpy = spyOn(store, 'dispatch');
    component.loginForm.setValue({
      emailOrUsername: 'invalid-email',
      password: 'short',
    });

    component.onLogin();

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('should close dialog on successful authentication', () => {
    store.overrideSelector(AuthSelectors.selectIsAuthenticated, true);
    store.refreshState();

    expect(dialogRef.close).toHaveBeenCalledWith({ success: true });
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(dialogRef.close).toHaveBeenCalledWith({ success: false });
  });

  it('should validate email format', () => {
    const emailControl = component.registerForm.get('email');
    emailControl?.setValue('invalid-email');
    emailControl?.markAsTouched();
    expect(component.hasError('email', 'register')).toBe(true);

    emailControl?.setValue('valid@example.com');
    expect(component.hasError('email', 'register')).toBe(false);
  });

  it('should validate password minimum length', () => {
    const passwordControl = component.loginForm.get('password');
    passwordControl?.setValue('short');
    passwordControl?.markAsTouched();
    expect(component.hasError('password', 'login')).toBe(true);

    passwordControl?.setValue('longenough');
    expect(component.hasError('password', 'login')).toBe(false);
  });

  it('should validate username length in register form', () => {
    const usernameControl = component.registerForm.get('username');
    usernameControl?.setValue('ab'); // Too short
    usernameControl?.markAsTouched();
    expect(component.hasError('username', 'register')).toBe(true);

    usernameControl?.setValue('a'.repeat(25)); // Too long
    expect(component.hasError('username', 'register')).toBe(true);

    usernameControl?.setValue('validuser');
    expect(component.hasError('username', 'register')).toBe(false);
  });

  it('should display error messages correctly', () => {
    component.registerForm.get('email')?.markAsTouched();
    expect(component.getErrorMessage('email', 'register')).toBe(
      'Email is required'
    );

    component.registerForm.get('email')?.setValue('invalid');
    expect(component.getErrorMessage('email', 'register')).toBe(
      'Please enter a valid email address'
    );

    component.loginForm.get('password')?.setValue('short');
    component.loginForm.get('password')?.markAsTouched();
    expect(component.getErrorMessage('password', 'login')).toContain(
      'at least 8 characters'
    );
  });
});
