import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import * as AuthActions from '../../../store/auth/auth.actions';
import * as AuthSelectors from '../../../store/auth/auth.selectors';

/**
 * Login/Register Modal Component
 * 
 * Material Design dialog for user authentication with:
 * - Login form (email, password)
 * - Register form (email, username, password)
 * - Mode switching between login and register
 * - Form validation and error display
 * - NGRX integration for auth state management
 * 
 * **Form Validation**:
 * - Email: Required, valid email format
 * - Username: Required, 3-20 characters (register only)
 * - Password: Required, minimum 8 characters
 * 
 * **NGRX Actions**:
 * - Dispatches `login` or `register` actions on form submit
 * - Subscribes to auth state for loading/error states
 * - Closes modal on successful authentication
 * 
 * @selector harmonia-login-modal
 */
@Component({
  selector: 'harmonia-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
  standalone: false
})
export class LoginModalComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private store = inject(Store);
  private dialogRef = inject(MatDialogRef<LoginModalComponent>);
  private ngZone = inject(NgZone);

  loginForm!: FormGroup;
  registerForm!: FormGroup;
  mode: 'login' | 'register' = 'login';
  hidePassword = true;
  
  loading$ = this.store.select(AuthSelectors.selectAuthLoading);
  error$ = this.store.select(AuthSelectors.selectAuthError);
  isAuthenticated$ = this.store.select(AuthSelectors.selectIsAuthenticated);
  
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initializeForms();
    
    // Close modal on successful authentication
    this.isAuthenticated$.pipe(takeUntil(this.destroy$)).subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.dialogRef.close({ success: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize login and register forms with validation
   */
  private initializeForms(): void {
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  /**
   * Switch between login and register modes
   */
  toggleMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    // Clear form values and errors when switching modes
    this.ngZone.run(() => {
      this.loginForm.reset();
      this.registerForm.reset();
    });
  }

  /**
   * Submit login form
   */
  onLogin(): void {
    if (this.loginForm.valid) {
      const { emailOrUsername, password } = this.loginForm.value;
      
      // Defensive check - ensure values exist
      if (!emailOrUsername || !password) {
        console.error('Login form values missing:', { emailOrUsername, password });
        return;
      }
      
      // Ensure dispatch happens inside NgZone
      this.ngZone.run(() => {
        this.store.dispatch(AuthActions.login({ emailOrUsername, password }));
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  /**
   * Submit register form
   */
  onRegister(): void {
    if (this.registerForm.valid) {
      const { email, username, password } = this.registerForm.value;
      // Ensure dispatch happens inside NgZone
      this.ngZone.run(() => {
        this.store.dispatch(AuthActions.register({ email, username, password }));
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }

  /**
   * Close modal without action
   */
  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  /**
   * Get error message for form field
   */
  getErrorMessage(field: string, formType: 'login' | 'register'): string {
    const form = formType === 'login' ? this.loginForm : this.registerForm;
    const control = form.get(field);

    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return `${this.getFieldLabel(field)} is required`;
    }
    if (control.errors['email']) {
      return 'Please enter a valid email address';
    }
    if (control.errors['minlength']) {
      const minLength = control.errors['minlength'].requiredLength;
      return `${this.getFieldLabel(field)} must be at least ${minLength} characters`;
    }
    if (control.errors['maxlength']) {
      const maxLength = control.errors['maxlength'].requiredLength;
      return `${this.getFieldLabel(field)} must be no more than ${maxLength} characters`;
    }

    return 'Invalid value';
  }

  /**
   * Get human-readable field label
   */
  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      email: 'Email',
      emailOrUsername: 'Email or Username',
      username: 'Username',
      password: 'Password'
    };
    return labels[field] || field;
  }

  /**
   * Check if form field has error
   */
  hasError(field: string, formType: 'login' | 'register'): boolean {
    const form = formType === 'login' ? this.loginForm : this.registerForm;
    const control = form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}
