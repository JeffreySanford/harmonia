import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LoginModalComponent } from './login-modal/login-modal.component';
import { HeaderUserMenuComponent } from './header-user-menu/header-user-menu.component';
import { AuthMaterialModule } from './auth-material.module';

/**
 * Authentication Module
 * 
 * Contains authentication-related components:
 * - Login/Register modal dialog
 * - Header user menu with dropdown
 * - Password reset forms (future)
 * - Email verification (future)
 * 
 * **Dependencies**:
 * - ReactiveFormsModule for form handling
 * - RouterModule for navigation
 * - AuthMaterialModule for Material Design components
 * 
 * **State Management**:
 * - Uses NGRX store for auth state (configured in AppModule)
 * - Dispatches auth actions (login, register, logout)
 * - Subscribes to auth selectors (user, loading, error)
 * 
 * @see {@link file://./docs/AUTHENTICATION_SYSTEM.md} for architecture
 */
@NgModule({
  declarations: [
    LoginModalComponent,
    HeaderUserMenuComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AuthMaterialModule
  ],
  exports: [
    LoginModalComponent,
    HeaderUserMenuComponent
  ]
})
export class AuthModule { }
