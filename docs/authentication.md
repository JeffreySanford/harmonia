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
    password: 'user123!',
    group: UserGroup.USER
  },
  {
    username: 'admin',
    email: 'admin@harmonia.local',
    password: 'admin123!',
    group: UserGroup.ADMIN
  }
];
```

## Current Implementation Status

**Date**: December 2, 2025  
**Status**: Frontend Complete ✅ | Backend Pending ⏳

### ✅ Completed - Frontend Implementation

#### Components Created (37 files)

##### Authentication Components

1. **Login Modal Component** (`features/auth/login-modal/`)
   - Component, template, styles, tests
   - Dual-mode form (login/register)
   - Material Design with validation
   - NGRX integration for state

2. **Header User Menu** (`features/auth/header-user-menu/`)
   - Component, template, styles, tests
   - Dropdown menu with navigation
   - Role-based conditional rendering
   - Logout functionality

##### Placeholder Pages

1. **Library Module** (`features/library/`)
   - Module, routing, component (ts, html, scss)
   - Material module for icons
   - Protected by `authGuard`

2. **Profile Module** (`features/profile/`)
   - Module, routing, component (ts, html, scss)
   - Material module for icons
   - User info display
   - Protected by `authGuard`

3. **Admin Module** (`features/admin/`)
   - Module, routing, component (ts, html, scss)
   - Material module for icons
   - Feature grid layout
   - Protected by `authGuard` + `adminGuard`

##### Infrastructure

1. **Route Guards** (`guards/`)
   - `authGuard` - Protect authenticated routes
   - `adminGuard` - Admin-only access
   - `guestGuard` - Prevent authenticated access
   - Unit tests for all guards
   - Index file for exports

2. **HTTP Interceptor** (`interceptors/`)
   - `AuthInterceptor` - Auto-attach JWT tokens
   - 401 error handling with auto-logout
   - Skip auth endpoints
   - Unit tests

3. **Services**
   - `AuthUiService` - Modal management
   - Unit tests

4. **Routing** (`app.routes.ts`)
   - Library route with `authGuard`
   - Profile route with `authGuard`
   - Admin route with `authGuard` + `adminGuard`
   - Lazy-loaded modules

#### Quality Metrics

- **Lint Status**: ✅ 0 errors, 22 warnings (non-blocking)
- **Type Safety**: ✅ All TypeScript compiles
- **Test Coverage**: 25+ unit tests created
- **Code Style**: ✅ Uses inject() pattern throughout
- **Selectors**: ✅ All use "harmonia-" prefix

### ⏳ Next Phase - Backend Implementation

#### Required Backend Tasks

##### 1. NestJS Dependencies

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
pnpm add -D @types/bcrypt @types/passport-jwt
```

##### 2. MongoDB User Schema

Create `apps/backend/src/schemas/user.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  // Instance method for password validation
  async validatePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Pre-save middleware for password hashing
UserSchema.pre<User>('save', async function(next) {
  if (!this.isModified('password')) return next();

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});
```

## Future Enhanced Features

### Password Reset Flow

#### Feature Description

**Purpose**: Allow users to securely reset their passwords when forgotten, with email-based verification.

**Security Considerations**:

- Time-limited reset tokens (15 minutes)
- Single-use tokens
- Rate limiting on reset requests
- Secure token generation and validation

#### User Flow

1. **Request Reset**: User clicks "Forgot Password" on login modal
2. **Email Verification**: User enters email address
3. **Token Generation**: System generates secure reset token
4. **Email Delivery**: Reset link sent to user's email
5. **Token Validation**: User clicks link, system validates token
6. **Password Update**: User sets new password
7. **Confirmation**: Success message and automatic login

#### Technical Implementation

##### Frontend Components

```typescript
// forgot-password.component.ts
export class ForgotPasswordComponent {
  resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    const email = this.resetForm.value.email;
    this.authService.requestPasswordReset(email).subscribe({
      next: () => this.showSuccessMessage(),
      error: (error) => this.handleError(error),
    });
  }
}
```

```typescript
// reset-password.component.ts
export class ResetPasswordComponent implements OnInit {
  resetForm = this.fb.group(
    {
      token: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  ngOnInit(): void {
    // Extract token from URL params
    this.route.queryParams.subscribe((params) => {
      this.resetForm.patchValue({ token: params.token });
    });
  }

  onSubmit(): void {
    this.authService.resetPassword(this.resetForm.value).subscribe({
      next: () => this.router.navigate(['/login']),
      error: (error) => this.handleError(error),
    });
  }
}
```

##### Backend Implementation

```typescript
// auth.controller.ts
@Post('forgot-password')
async forgotPassword(@Body() dto: ForgotPasswordDto) {
  return this.authService.requestPasswordReset(dto.email);
}

@Post('reset-password')
async resetPassword(@Body() dto: ResetPasswordDto) {
  return this.authService.resetPassword(dto.token, dto.newPassword);
}
```

```typescript
// auth.service.ts
async requestPasswordReset(email: string): Promise<void> {
  const user = await this.userModel.findOne({ email });
  if (!user) {
    // Don't reveal if email exists for security
    return;
  }

  const resetToken = this.generateSecureToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await this.resetTokenModel.create({
    userId: user._id,
    token: resetToken,
    expiresAt,
  });

  // Send email with reset link
  await this.emailService.sendPasswordResetEmail(user.email, resetToken);
}
```

### Two-Factor Authentication (2FA)

#### Feature Description

**Purpose**: Add an extra layer of security requiring a second form of verification beyond password.

**Supported Methods**:

- TOTP (Time-based One-Time Password) via authenticator apps
- SMS-based codes
- Email-based codes

#### Technical Implementation

##### Database Schema Extension

```typescript
@Schema({ timestamps: true })
export class User extends Document {
  // ... existing fields

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop()
  twoFactorSecret?: string; // Encrypted TOTP secret

  @Prop({ enum: ['totp', 'sms', 'email'], default: null })
  twoFactorMethod?: string;

  @Prop()
  phoneNumber?: string; // For SMS 2FA

  @Prop()
  backupCodes?: string[]; // Encrypted backup codes
}
```

##### Frontend Components

```typescript
// enable-2fa.component.ts
export class EnableTwoFactorComponent {
  qrCodeUrl: string;
  backupCodes: string[];

  enableTOTP(): void {
    this.authService.enableTOTP().subscribe({
      next: (response) => {
        this.qrCodeUrl = response.qrCodeUrl;
        this.backupCodes = response.backupCodes;
      }
    });
  }

  verifyAndEnable(code: string): void {
    this.authService.verifyTOTP(code).subscribe({
      next: () => this.showSuccess(),
    });
  }
}
```

### Social Login Integration

#### Supported Providers

- Google OAuth 2.0
- GitHub OAuth
- Microsoft Azure AD

#### Implementation Strategy

##### OAuth Flow

1. **Initiate Login**: User clicks social login button
2. **Redirect to Provider**: Frontend redirects to OAuth provider
3. **Authorization**: User grants permissions
4. **Callback**: Provider redirects back with authorization code
5. **Token Exchange**: Backend exchanges code for access token
6. **User Creation/Update**: Create or update user account
7. **JWT Issuance**: Issue application JWT token

##### Backend Implementation

```typescript
// auth.controller.ts
@Get('google')
@UseGuards(AuthGuard('google'))
async googleAuth(@Req() req) {}

@Get('google/callback')
@UseGuards(AuthGuard('google'))
async googleAuthRedirect(@Req() req, @Res() res) {
  const { accessToken } = await this.authService.loginWithGoogle(req.user);
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);
}
```

```typescript
// auth.service.ts
async loginWithGoogle(googleUser: any): Promise<{ accessToken: string }> {
  let user = await this.userModel.findOne({ email: googleUser.email });

  if (!user) {
    user = await this.userModel.create({
      username: googleUser.email.split('@')[0],
      email: googleUser.email,
      // Generate random password for social users
      password: this.generateRandomPassword(),
      socialId: googleUser.id,
      socialProvider: 'google',
    });
  }

  const payload = { sub: user._id, email: user.email, role: user.role };
  const accessToken = this.jwtService.sign(payload);

  return { accessToken };
}
```

### Session Management Enhancements

#### Concurrent Session Limits

- Limit users to maximum 5 concurrent sessions
- Automatic logout of oldest session when limit exceeded
- Session management dashboard for users

#### Device Tracking

- Track login device information (OS, browser, IP)
- Display active sessions in user profile
- Allow users to revoke specific sessions

#### Security Monitoring

- Failed login attempt tracking
- Suspicious activity detection
- Account lockout after multiple failures
- Security event logging and alerting
