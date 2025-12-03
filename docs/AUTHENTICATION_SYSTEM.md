# Authentication & Authorization System

## Overview

Comprehensive authentication and authorization system with role-based access control (RBAC), JWT tokens, Redis session caching, and MongoDB user storage.

**Core Features**:

- User registration and login with bcrypt password hashing
- JWT token-based authentication with refresh tokens
- Role-based access control (user, admin groups)
- Permission inheritance (admin inherits user rights)
- Route guards for protected views
- Redis session caching for performance
- MongoDB user and session storage
- Login overlay modal (non-intrusive UI)
- Header user menu with dropdown
- Secure HTTP-only cookies for token storage

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│  │    Header    │    │    Login     │    │    Route     │        │
│  │  User Icon   │───>│   Overlay    │───>│    Guards    │        │
│  │  + Dropdown  │    │    Modal     │    │ (AuthGuard)  │        │
│  └──────────────┘    └──────────────┘    └──────────────┘        │
│         │                   │                    │                 │
│         └───────────────────┴────────────────────┘                 │
│                             │                                       │
│                    ┌────────▼────────┐                             │
│                    │  NGRX Auth      │                             │
│                    │  State Store    │                             │
│                    └────────┬────────┘                             │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   HTTP Service    │
                    │  (Auth Tokens)    │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                         Backend (NestJS)                            │
├─────────────────────────────┼───────────────────────────────────────┤
│                             │                                       │
│     ┌───────────────────────▼──────────────────────┐               │
│     │         Auth Controller                      │               │
│     │  /api/auth/register                          │               │
│     │  /api/auth/login                             │               │
│     │  /api/auth/logout                            │               │
│     │  /api/auth/refresh                           │               │
│     │  /api/auth/me                                │               │
│     └───────────────────┬──────────────────────────┘               │
│                         │                                           │
│     ┌───────────────────▼──────────────────────┐                   │
│     │         Auth Service                     │                   │
│     │  - JWT generation/validation             │                   │
│     │  - Password hashing (bcrypt)             │                   │
│     │  - Token refresh logic                   │                   │
│     │  - Session management                    │                   │
│     └───────────────────┬──────────────────────┘                   │
│                         │                                           │
│         ┌───────────────┴───────────────┐                          │
│         │                               │                          │
│  ┌──────▼──────┐              ┌────────▼────────┐                 │
│  │   Redis     │              │    MongoDB      │                 │
│  │   Cache     │              │   User Store    │                 │
│  │  Sessions   │              │   + Library     │                 │
│  └─────────────┘              └─────────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## User Roles & Groups System

### Groups Hierarchy

```typescript
enum UserGroup {
  USER = 'user',      // Basic authenticated user
  ADMIN = 'admin'     // Administrator with elevated privileges
}

// Permission inheritance
// admin → inherits all 'user' permissions + admin-specific permissions
```

### Default Users

```typescript
// Seed data for initial setup
const defaultUsers = [
  {
    username: 'user',
    email: 'user@harmonia.local',
    password: 'user123',        // Hashed with bcrypt
    groups: ['user'],
    createdAt: new Date()
  },
  {
    username: 'admin',
    email: 'admin@harmonia.local',
    password: 'admin123',       // Hashed with bcrypt
    groups: ['admin', 'user'],  // Admin inherits user permissions
    createdAt: new Date()
  }
];
```

### Permissions Matrix

| Feature | User | Admin |
|---------|------|-------|
| Song Generation | ✅ | ✅ (inherited) |
| Music Generation | ✅ | ✅ (inherited) |
| Video Generation | ✅ | ✅ (inherited) |
| Video Editing | ✅ | ✅ (inherited) |
| View Own Library | ✅ | ✅ (inherited) |
| Download Own Files | ✅ | ✅ (inherited) |
| Delete Own Files | ✅ | ✅ (inherited) |
| **User Management** | ❌ | ✅ (admin-only) |
| **View All Users** | ❌ | ✅ (admin-only) |
| **View All Files** | ❌ | ✅ (admin-only) |
| **Request/Response Logs** | ❌ | ✅ (admin-only) |
| **Performance Metrics** | ❌ | ✅ (admin-only) |
| **System Settings** | ❌ | ✅ (admin-only) |

### Future Groups (Extensible)

```typescript
// Planned for future releases
enum FutureGroups {
  MODERATOR = 'moderator',    // Content moderation
  PREMIUM = 'premium',        // Premium features
  DEVELOPER = 'developer',    // API access
  ANALYST = 'analyst'         // Read-only analytics
}
```

## Authentication Flow

### Registration Flow

```text
1. User clicks "Sign Up" in header menu
   ↓
2. Login overlay opens in "Register" mode
   ↓
3. User enters:
   - Username (unique, 3-20 chars)
   - Email (unique, validated)
   - Password (min 8 chars, complexity rules)
   - Confirm Password
   ↓
4. Frontend validation:
   - Email format check
   - Password strength check
   - Password match check
   ↓
5. POST /api/auth/register
   {
     username: "johndoe",
     email: "john@example.com",
     password: "SecurePass123!"
   }
   ↓
6. Backend validation:
   - Check username uniqueness
   - Check email uniqueness
   - Hash password with bcrypt (10 rounds)
   - Assign default group: ['user']
   ↓
7. Create user in MongoDB
   ↓
8. Generate JWT tokens:
   - Access Token (15 min expiry)
   - Refresh Token (7 days expiry)
   ↓
9. Store session in Redis:
   Key: "session:{userId}"
   Value: { userId, groups, lastActivity }
   TTL: 7 days
   ↓
10. Return tokens to frontend:
    - Set HTTP-only cookie: refreshToken
    - Return JSON: { accessToken, user: { id, username, email, groups } }
    ↓
11. Frontend stores in NGRX:
    - Dispatch: authLogin({ user, accessToken })
    - Store accessToken in memory
    - Update auth state: { user, isAuthenticated: true }
    ↓
12. Redirect to dashboard or previous route
    ↓
13. Show success message: "Welcome, {username}!"
```

### Login Flow

```text
1. User clicks user icon in header (not authenticated)
   ↓
2. Login overlay modal opens
   ↓
3. User enters:
   - Email or Username
   - Password
   ↓
4. POST /api/auth/login
   {
     identifier: "john@example.com",
     password: "SecurePass123!"
   }
   ↓
5. Backend validation:
   - Find user by email or username
   - Compare password with bcrypt
   ↓
6. If valid:
   - Generate new JWT tokens
   - Update Redis session
   - Return tokens + user data
   ↓
7. If invalid:
   - Return 401 Unauthorized
   - Show error: "Invalid credentials"
   ↓
8. Frontend on success:
   - Store tokens
   - Update NGRX state
   - Close modal
   - Redirect if needed
   ↓
9. Header user icon updates:
   - Show username + avatar
   - Enable dropdown menu
```

### Token Refresh Flow

```text
1. Access token expires (15 min)
   ↓
2. HTTP request fails with 401
   ↓
3. HTTP Interceptor catches error
   ↓
4. POST /api/auth/refresh
   Headers: Cookie: refreshToken={token}
   ↓
5. Backend validates refresh token:
   - Decode JWT
   - Check Redis session exists
   - Verify not expired
   ↓
6. If valid:
   - Generate new access token
   - Update Redis session lastActivity
   - Return new access token
   ↓
7. If invalid:
   - Clear session
   - Return 401
   - Trigger logout flow
   ↓
8. Frontend on success:
   - Update access token in memory
   - Retry original HTTP request
   ↓
9. Frontend on failure:
   - Clear auth state
   - Redirect to login
   - Show: "Session expired. Please log in again."
```

### Logout Flow

```text
1. User clicks "Logout" in dropdown menu
   ↓
2. Confirmation dialog (optional)
   ↓
3. POST /api/auth/logout
   Headers: Authorization: Bearer {accessToken}
   ↓
4. Backend:
   - Delete Redis session
   - Invalidate refresh token
   - Clear HTTP-only cookie
   ↓
5. Frontend:
   - Clear NGRX auth state
   - Clear access token from memory
   - Redirect to home page
   - Show: "Logged out successfully"
```

## JWT Token Structure

### Access Token

```typescript
{
  // Header
  alg: "HS256",
  typ: "JWT",

  // Payload
  sub: "507f1f77bcf86cd799439011",  // User ID
  username: "johndoe",
  email: "john@example.com",
  groups: ["user"],
  iat: 1701561600,                   // Issued at
  exp: 1701562500                    // Expires at (15 min)
}
```

### Refresh Token

```typescript
{
  // Header
  alg: "HS256",
  typ: "JWT",

  // Payload
  sub: "507f1f77bcf86cd799439011",  // User ID
  type: "refresh",
  iat: 1701561600,                   // Issued at
  exp: 1702166400                    // Expires at (7 days)
}
```

### Token Security

- **Secret Key**: Stored in environment variable (256-bit random)
- **Signing Algorithm**: HS256 (HMAC with SHA-256)
- **Storage**:
  - Access Token: Memory only (NGRX store, not localStorage)
  - Refresh Token: HTTP-only cookie (not accessible to JavaScript)
- **Transmission**: HTTPS only in production
- **Rotation**: Refresh token rotates on each use (optional, recommended)

## MongoDB User Schema

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, minlength: 3, maxlength: 20 })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, select: false })  // Never include in queries by default
  password: string;

  @Prop({ type: [String], enum: ['user', 'admin'], default: ['user'] })
  groups: string[];

  @Prop({ default: null })
  avatar?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: null })
  lastLoginAt?: Date;

  @Prop({ default: 0 })
  loginCount: number;

  // Timestamps added by @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ groups: 1 });

// Virtual for full name (if first/last name added later)
UserSchema.virtual('displayName').get(function() {
  return this.username;
});
```

## Redis Session Storage

### Session Key Structure

```text
session:{userId}

Example:
session:507f1f77bcf86cd799439011
```

### Session Data

```typescript
interface RedisSession {
  userId: string;
  username: string;
  email: string;
  groups: string[];
  accessToken: string;
  refreshToken: string;
  createdAt: number;          // Unix timestamp
  lastActivity: number;       // Unix timestamp
  ipAddress: string;
  userAgent: string;
}

// Stored as JSON string in Redis
// TTL: 7 days (604800 seconds)
```

### Redis Commands

```typescript
// Store session
await redis.setex(
  `session:${userId}`,
  604800,  // 7 days
  JSON.stringify(sessionData)
);

// Get session
const sessionStr = await redis.get(`session:${userId}`);
const session = JSON.parse(sessionStr);

// Update last activity
await redis.setex(
  `session:${userId}`,
  604800,
  JSON.stringify({ ...session, lastActivity: Date.now() })
);

// Delete session (logout)
await redis.del(`session:${userId}`);

// Get all active sessions (admin)
const keys = await redis.keys('session:*');
const sessions = await Promise.all(
  keys.map(key => redis.get(key))
);
```

## Frontend Implementation

### Header User Menu Component

```typescript
// header-user-menu.component.ts
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as fromAuth from '../../store/auth/auth.selectors';
import * as AuthActions from '../../store/auth/auth.actions';

@Component({
  selector: 'app-header-user-menu',
  templateUrl: './header-user-menu.component.html',
  styleUrls: ['./header-user-menu.component.scss']
})
export class HeaderUserMenuComponent implements OnInit {
  isAuthenticated$!: Observable<boolean>;
  user$!: Observable<User | null>;
  isAdmin$!: Observable<boolean>;

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.isAuthenticated$ = this.store.select(fromAuth.selectIsAuthenticated);
    this.user$ = this.store.select(fromAuth.selectUser);
    this.isAdmin$ = this.store.select(fromAuth.selectIsAdmin);
  }

  openLoginModal(): void {
    this.store.dispatch(AuthActions.openLoginModal());
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }

  navigateToLibrary(): void {
    // Handled by routerLink in template
  }

  navigateToAdmin(): void {
    // Handled by routerLink in template
  }
}
```

```html
<!-- header-user-menu.component.html -->
<div class="user-menu">
  <!-- Not Authenticated -->
  <button 
    *ngIf="!(isAuthenticated$ | async)"
    mat-icon-button
    (click)="openLoginModal()"
    class="user-icon-button"
  >
    <mat-icon>account_circle</mat-icon>
  </button>

  <!-- Authenticated -->
  <div *ngIf="isAuthenticated$ | async" class="authenticated-menu">
    <button 
      mat-icon-button 
      [matMenuTriggerFor]="userMenu"
      class="user-icon-button"
    >
      <mat-icon>account_circle</mat-icon>
      <span class="username">{{ (user$ | async)?.username }}</span>
    </button>

    <mat-menu #userMenu="matMenu" xPosition="before">
      <!-- User Info -->
      <div class="menu-header" mat-menu-item disabled>
        <div class="user-info">
          <mat-icon>person</mat-icon>
          <div>
            <div class="username">{{ (user$ | async)?.username }}</div>
            <div class="email">{{ (user$ | async)?.email }}</div>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- User Actions -->
      <button mat-menu-item routerLink="/library">
        <mat-icon>library_music</mat-icon>
        <span>My Library</span>
      </button>

      <button mat-menu-item routerLink="/profile">
        <mat-icon>settings</mat-icon>
        <span>Profile Settings</span>
      </button>

      <!-- Admin Actions -->
      <ng-container *ngIf="isAdmin$ | async">
        <mat-divider></mat-divider>
        <button mat-menu-item routerLink="/admin">
          <mat-icon>admin_panel_settings</mat-icon>
          <span>Admin Dashboard</span>
        </button>
      </ng-container>

      <mat-divider></mat-divider>

      <!-- Logout -->
      <button mat-menu-item (click)="logout()">
        <mat-icon>logout</mat-icon>
        <span>Logout</span>
      </button>
    </mat-menu>
  </div>
</div>
```

### Login Overlay Modal Component

```typescript
// login-modal.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as fromAuth from '../../store/auth/auth.selectors';
import * as AuthActions from '../../store/auth/auth.actions';

@Component({
  selector: 'app-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss']
})
export class LoginModalComponent implements OnInit {
  loginForm!: FormGroup;
  registerForm!: FormGroup;
  mode: 'login' | 'register' = 'login';
  
  isModalOpen$!: Observable<boolean>;
  isLoading$!: Observable<boolean>;
  error$!: Observable<string | null>;

  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private store: Store
  ) {}

  ngOnInit(): void {
    this.isModalOpen$ = this.store.select(fromAuth.selectIsLoginModalOpen);
    this.isLoading$ = this.store.select(fromAuth.selectIsLoading);
    this.error$ = this.store.select(fromAuth.selectError);

    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup): null | { mismatch: true } {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.store.dispatch(AuthActions.clearError());
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      this.store.dispatch(AuthActions.login(this.loginForm.value));
    }
  }

  onRegister(): void {
    if (this.registerForm.valid) {
      const { username, email, password } = this.registerForm.value;
      this.store.dispatch(AuthActions.register({ username, email, password }));
    }
  }

  closeModal(): void {
    this.store.dispatch(AuthActions.closeLoginModal());
  }
}
```

```html
<!-- login-modal.component.html -->
<div class="modal-overlay" *ngIf="isModalOpen$ | async" (click)="closeModal()">
  <div class="modal-container" (click)="$event.stopPropagation()">
    <button mat-icon-button class="close-button" (click)="closeModal()">
      <mat-icon>close</mat-icon>
    </button>

    <div class="modal-header">
      <h2>{{ mode === 'login' ? 'Sign In' : 'Create Account' }}</h2>
      <p>{{ mode === 'login' ? 'Welcome back!' : 'Join Harmonia today' }}</p>
    </div>

    <!-- Login Form -->
    <form *ngIf="mode === 'login'" [formGroup]="loginForm" (ngSubmit)="onLogin()" class="auth-form">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email or Username</mat-label>
        <input matInput formControlName="identifier" placeholder="Enter email or username">
        <mat-icon matPrefix>person</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Password</mat-label>
        <input 
          matInput 
          [type]="hidePassword ? 'password' : 'text'"
          formControlName="password"
          placeholder="Enter password"
        >
        <mat-icon matPrefix>lock</mat-icon>
        <button 
          mat-icon-button 
          matSuffix 
          type="button"
          (click)="hidePassword = !hidePassword"
        >
          <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
      </mat-form-field>

      <div class="error-message" *ngIf="error$ | async as error">
        <mat-icon>error</mat-icon>
        {{ error }}
      </div>

      <button 
        mat-raised-button 
        color="primary" 
        type="submit"
        [disabled]="loginForm.invalid || (isLoading$ | async)"
        class="submit-button"
      >
        {{ (isLoading$ | async) ? 'Signing in...' : 'Sign In' }}
      </button>
    </form>

    <!-- Register Form -->
    <form *ngIf="mode === 'register'" [formGroup]="registerForm" (ngSubmit)="onRegister()" class="auth-form">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Username</mat-label>
        <input matInput formControlName="username" placeholder="Choose a username">
        <mat-icon matPrefix>person</mat-icon>
        <mat-hint>3-20 characters</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email</mat-label>
        <input matInput formControlName="email" placeholder="Enter email address">
        <mat-icon matPrefix>email</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Password</mat-label>
        <input 
          matInput 
          [type]="hidePassword ? 'password' : 'text'"
          formControlName="password"
          placeholder="Create password"
        >
        <mat-icon matPrefix>lock</mat-icon>
        <button 
          mat-icon-button 
          matSuffix 
          type="button"
          (click)="hidePassword = !hidePassword"
        >
          <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-hint>Minimum 8 characters</mat-hint>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Confirm Password</mat-label>
        <input 
          matInput 
          [type]="hideConfirmPassword ? 'password' : 'text'"
          formControlName="confirmPassword"
          placeholder="Confirm password"
        >
        <mat-icon matPrefix>lock</mat-icon>
        <button 
          mat-icon-button 
          matSuffix 
          type="button"
          (click)="hideConfirmPassword = !hideConfirmPassword"
        >
          <mat-icon>{{ hideConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-error *ngIf="registerForm.hasError('mismatch')">
          Passwords do not match
        </mat-error>
      </mat-form-field>

      <div class="error-message" *ngIf="error$ | async as error">
        <mat-icon>error</mat-icon>
        {{ error }}
      </div>

      <button 
        mat-raised-button 
        color="primary" 
        type="submit"
        [disabled]="registerForm.invalid || (isLoading$ | async)"
        class="submit-button"
      >
        {{ (isLoading$ | async) ? 'Creating account...' : 'Create Account' }}
      </button>
    </form>

    <!-- Mode Switch -->
    <div class="mode-switch">
      <p *ngIf="mode === 'login'">
        Don't have an account? 
        <a (click)="switchMode()">Sign up</a>
      </p>
      <p *ngIf="mode === 'register'">
        Already have an account? 
        <a (click)="switchMode()">Sign in</a>
      </p>
    </div>
  </div>
</div>
```

### Route Guards

```typescript
// auth.guard.ts
import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import * as fromAuth from '../store/auth/auth.selectors';
import * as AuthActions from '../store/auth/auth.actions';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private store: Store,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    return this.store.select(fromAuth.selectIsAuthenticated).pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        }

        // Store intended URL for redirect after login
        const returnUrl = route.url.map(segment => segment.path).join('/');
        this.store.dispatch(AuthActions.setReturnUrl({ returnUrl }));
        
        // Open login modal instead of navigating
        this.store.dispatch(AuthActions.openLoginModal());
        return false;
      })
    );
  }
}

// admin.guard.ts
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private store: Store,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.store.select(fromAuth.selectIsAdmin).pipe(
      take(1),
      map(isAdmin => {
        if (isAdmin) {
          return true;
        }

        // Redirect to home if not admin
        this.router.navigate(['/']);
        return false;
      })
    );
  }
}
```

### App Routes with Guards

```typescript
// app.routes.ts
import { Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

export const appRoutes: Route[] = [
  {
    path: 'generate/song',
    loadChildren: () =>
      import('./features/song-generation/song-generation.module').then(
        (m) => m.SongGenerationModule
      ),
    canActivate: [AuthGuard]  // Requires authentication
  },
  {
    path: 'generate/music',
    loadChildren: () =>
      import('./features/music-generation/music-generation.module').then(
        (m) => m.MusicGenerationModule
      ),
    canActivate: [AuthGuard]  // Requires authentication
  },
  {
    path: 'generate/video',
    loadChildren: () =>
      import('./features/video-generation/video-generation.module').then(
        (m) => m.VideoGenerationModule
      ),
    canActivate: [AuthGuard]  // Requires authentication
  },
  {
    path: 'library',
    loadChildren: () =>
      import('./features/library/library.module').then(
        (m) => m.LibraryModule
      ),
    canActivate: [AuthGuard]  // Requires authentication
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.module').then(
        (m) => m.AdminModule
      ),
    canActivate: [AuthGuard, AdminGuard]  // Requires admin role
  },
  {
    path: '',
    redirectTo: '/generate/song',
    pathMatch: 'full'
  }
];
```

## NGRX Auth State

### State Interface

```typescript
// auth.state.ts
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isLoginModalOpen: boolean;
  returnUrl: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isLoginModalOpen: false,
  returnUrl: null
};
```

### Actions

```typescript
// auth.actions.ts
import { createAction, props } from '@ngrx/store';

// Login
export const login = createAction(
  '[Auth] Login',
  props<{ identifier: string; password: string }>()
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: User; accessToken: string }>()
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);

// Register
export const register = createAction(
  '[Auth] Register',
  props<{ username: string; email: string; password: string }>()
);

export const registerSuccess = createAction(
  '[Auth] Register Success',
  props<{ user: User; accessToken: string }>()
);

export const registerFailure = createAction(
  '[Auth] Register Failure',
  props<{ error: string }>()
);

// Logout
export const logout = createAction('[Auth] Logout');
export const logoutSuccess = createAction('[Auth] Logout Success');

// Token Refresh
export const refreshToken = createAction('[Auth] Refresh Token');
export const refreshTokenSuccess = createAction(
  '[Auth] Refresh Token Success',
  props<{ accessToken: string }>()
);
export const refreshTokenFailure = createAction('[Auth] Refresh Token Failure');

// Modal
export const openLoginModal = createAction('[Auth] Open Login Modal');
export const closeLoginModal = createAction('[Auth] Close Login Modal');

// Error
export const clearError = createAction('[Auth] Clear Error');

// Return URL
export const setReturnUrl = createAction(
  '[Auth] Set Return URL',
  props<{ returnUrl: string }>()
);
```

### Selectors

```typescript
// auth.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from './auth.state';

export const selectAuthState = createFeatureSelector<AuthState>('auth');

export const selectUser = createSelector(
  selectAuthState,
  (state) => state.user
);

export const selectAccessToken = createSelector(
  selectAuthState,
  (state) => state.accessToken
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state) => state.isAuthenticated
);

export const selectIsLoading = createSelector(
  selectAuthState,
  (state) => state.isLoading
);

export const selectError = createSelector(
  selectAuthState,
  (state) => state.error
);

export const selectIsLoginModalOpen = createSelector(
  selectAuthState,
  (state) => state.isLoginModalOpen
);

export const selectIsAdmin = createSelector(
  selectUser,
  (user) => user?.groups.includes('admin') ?? false
);

export const selectUserGroups = createSelector(
  selectUser,
  (user) => user?.groups ?? []
);
```

## Backend Implementation

### Auth Module Structure

```text
apps/backend/src/app/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── register.dto.ts
│   │   └── auth-response.dto.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── admin.guard.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       └── roles.decorator.ts
```

### Auth Controller

```typescript
// auth.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.register(registerDto);
    
    // Set refresh token in HTTP-only cookie
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    return {
      accessToken: result.accessToken,
      user: result.user
    };
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(loginDto);
    
    // Set refresh token in HTTP-only cookie
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return {
      accessToken: result.accessToken,
      user: result.user
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.logout(user.sub);
    
    // Clear refresh token cookie
    response.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  async refresh(
    @Req() request: any,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = request.cookies['refreshToken'];
    const result = await this.authService.refreshToken(refreshToken);

    // Set new refresh token
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return {
      accessToken: result.accessToken
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getUserById(user.sub);
  }
}
```

### Auth Service

```typescript
// auth.service.ts
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginDto, RegisterDto } from './dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private redisService: RedisService
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

    // Check if user exists
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.userModel.create({
      username,
      email,
      password: hashedPassword,
      groups: ['user']
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store session in Redis
    await this.storeSession(user._id.toString(), tokens);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        groups: user.groups
      }
    };
  }

  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;

    // Find user by email or username
    const user = await this.userModel.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    }).select('+password');

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.loginCount++;
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store session in Redis
    await this.storeSession(user._id.toString(), tokens);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        groups: user.groups
      }
    };
  }

  async logout(userId: string) {
    // Delete session from Redis
    await this.redisService.del(`session:${userId}`);
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });

      // Check if session exists in Redis
      const session = await this.redisService.get(`session:${payload.sub}`);
      if (!session) {
        throw new UnauthorizedException('Session expired');
      }

      // Get user
      const user = await this.userModel.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update session in Redis
      await this.storeSession(user._id.toString(), tokens);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserById(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user._id,
      username: user.username,
      email: user.email,
      groups: user.groups,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
  }

  private async generateTokens(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
      groups: user.groups
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m'
    });

    const refreshToken = this.jwtService.sign(
      { sub: user._id.toString(), type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d'
      }
    );

    return { accessToken, refreshToken };
  }

  private async storeSession(userId: string, tokens: any) {
    const session = {
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    await this.redisService.setex(
      `session:${userId}`,
      7 * 24 * 60 * 60,  // 7 days
      JSON.stringify(session)
    );
  }
}
```

### Role Guards

```typescript
// roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.some(role => user.groups?.includes(role));
  }
}

// Usage with decorator
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Example usage in controller:
// @Get('admin-only')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
// async adminOnlyRoute() { }
```

## Security Best Practices

### Password Requirements

```typescript
// password.validator.ts
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### Rate Limiting

```typescript
// main.ts
import { rateLimit } from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

// Auth-specific rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // Limit to 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.'
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### CORS Configuration

```typescript
// main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,  // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
```

### Helmet for Security Headers

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Environment Variables

```bash
# .env
# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-here-256-bits
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-256-bits

# MongoDB
MONGODB_URI=mongodb://localhost:27017/harmonia

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Frontend
FRONTEND_URL=http://localhost:4200

# Node Environment
NODE_ENV=development
```

## Testing Strategy

### Unit Tests

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let userModel: Model<UserDocument>;
  let jwtService: JwtService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel
        },
        {
          provide: JwtService,
          useValue: mockJwtService
        },
        {
          provide: RedisService,
          useValue: mockRedisService
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create a new user', async () => {
      // Test implementation
    });

    it('should throw ConflictException if email exists', async () => {
      // Test implementation
    });

    it('should hash password before storing', async () => {
      // Test implementation
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      // Test implementation
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      // Test implementation
    });
  });
});
```

### E2E Tests

```typescript
// auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test123!'
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe('test@example.com');
        });
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should login existing user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'Test123!'
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('accessToken');
        });
    });
  });
});
```

## Future Enhancements

### OAuth Integration

- Google OAuth 2.0
- GitHub OAuth
- Microsoft OAuth

### Two-Factor Authentication (2FA)

- TOTP (Time-based One-Time Password)
- SMS verification
- Email verification codes

### Account Recovery

- Password reset via email
- Security questions
- Account recovery codes

### Session Management

- View all active sessions
- Revoke specific sessions
- Force logout from all devices

### Audit Logging

- Track all authentication attempts
- Log permission changes
- Monitor suspicious activity

---

**Document Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Status**: Design Complete - Implementation Ready
**Priority**: HIGH - Foundational System
