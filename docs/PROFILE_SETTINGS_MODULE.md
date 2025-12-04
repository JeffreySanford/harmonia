# Profile Settings Module

## Overview

The Profile Settings module provides authenticated users with a comprehensive interface to manage their account information, security settings, and personal preferences. This includes profile data management, password changes, avatar uploads, and account security features.

## Feature Description

**Purpose**: Allow users to maintain and update their personal information, manage account security, and customize their experience.

**User Benefit**: Complete control over account settings, enhanced security through password management, and personalized experience through avatar and preferences.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Profile Settings Page                           │  │
│  │  ┌────────────┬────────────┬────────────┬────────────┐      │  │
│  │  │   Profile  │  Security  │ Preferences│   Account   │      │  │
│  │  │    Tab     │    Tab     │    Tab     │    Tab      │      │  │
│  │  └────────────┴────────────┴────────────┴────────────┘      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│           │              │              │              │            │
│  ┌────────▼──────┐ ┌────▼──────┐ ┌────▼──────┐ ┌────▼──────┐    │
│  │ Profile Form  │ │Password   │ │Theme       │ │Delete      │    │
│  │ Component     │ │Change     │ │Settings    │ │Account     │    │
│  │ (Name, Email) │ │Component  │ │Component   │ │Component   │    │
│  └────────┬──────┘ └────┬──────┘ └────┬──────┘ └────┬──────┘    │
│           │              │              │              │            │
│  ┌────────▼──────────────▼──────────────▼──────────────▼──────┐  │
│  │              NGRX Profile State Store                       │  │
│  │  - profile: UserProfile                                      │  │
│  │  - preferences: UserPreferences                              │  │
│  │  - loading, error                                            │  │
│  └────────┬─────────────────────────────────────────────────────┘  │
│           │                                                         │
│  ┌────────▼─────────────────────────────────────────────────────┐  │
│  │              Profile Service (HTTP)                          │  │
│  └────────┬─────────────────────────────────────────────────────┘  │
│           │                                                         │
└───────────┼─────────────────────────────────────────────────────────┘
            │
            │ HTTP Requests (with JWT auth)
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                         Backend (NestJS)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐          │
│  │         Profile Controller                          │          │
│  │  GET  /api/user/profile                             │          │
│  │  PUT  /api/user/profile                             │          │
│  │  POST /api/user/change-password                     │          │
│  │  POST /api/user/upload-avatar                       │          │
│  │  DELETE /api/user/profile                           │          │
│  └──────────────┬───────────────────────────────────────┘          │
│                 │                                                   │
│  ┌──────────────▼───────────────────────────────────┐              │
│  │         Profile Service                          │              │
│  │  - getProfile(userId)                            │              │
│  │  - updateProfile(userId, data)                   │              │
│  │  - changePassword(userId, passwords)             │              │
│  │  - uploadAvatar(userId, file)                    │              │
│  │  - deleteAccount(userId)                         │              │
│  └──────────────┬───────────────────────────────────┘              │
│                 │                                                   │
│         ┌───────┴────────┬──────────────┐                          │
│         │                │              │                          │
│  ┌──────▼──────┐  ┌─────▼───────┐  ┌──▼──────────┐                │
│  │   MongoDB   │  │  File       │  │   Redis     │                │
│  │  - Users    │  │  Storage    │  │  (Cache)    │                │
│  │  - Profiles │  │  (S3/Local) │  │             │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## User Interface

### Tab Navigation

The profile settings are organized into four main tabs:

1. **Profile**: Basic user information and avatar
2. **Security**: Password change and account security
3. **Preferences**: Theme, notifications, and UI settings
4. **Account**: Account deletion and data export

### Profile Tab

**Fields**:

- Display Name (required)
- Email Address (read-only, change via separate flow)
- Bio/Description (optional, 500 chars max)
- Location (optional)
- Website (optional, URL validation)

**Avatar Upload**:

- Drag & drop or click to select
- Image crop/resize interface
- Max file size: 5MB
- Supported formats: JPG, PNG, GIF
- Automatic thumbnail generation

### Security Tab

**Password Change**:

- Current password field
- New password field (strength indicator)
- Confirm new password field
- Password requirements display

**Security Settings**:

- Login history (recent sessions)
- Active sessions list
- "Force logout all devices" button

### Preferences Tab

**Theme Settings**:

- Light/Dark mode toggle
- System preference detection
- Custom theme colors (future)

**Notification Settings**:

- Email notifications toggle
- Generation completion notifications
- Marketing communications opt-in

**UI Preferences**:

- Default view settings
- Language selection
- Timezone settings

### Account Tab

**Data Export**:

- Download all user data (GDPR compliance)
- Export format: JSON

**Account Deletion**:

- Confirmation dialog with warning
- Reason selection (optional)
- 30-day grace period before permanent deletion

## Technical Implementation

### Frontend Components

#### ProfileFormComponent

```typescript
export class ProfileFormComponent {
  profileForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.maxLength(50)]],
    bio: ['', [Validators.maxLength(500)]],
    location: ['', [Validators.maxLength(100)]],
    website: ['', [Validators.pattern(urlPattern)]],
  });

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.store.dispatch(updateProfile({ profile: this.profileForm.value }));
    }
  }
}
```

#### PasswordChangeComponent

```typescript
export class PasswordChangeComponent {
  passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  onSubmit(): void {
    // Implementation
  }
}
```

### Backend API

#### Profile DTOs

```typescript
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

#### Profile Controller

```typescript
@Controller('user')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  async getProfile(@Req() req: Request) {
    return this.profileService.getProfile(req.user.id);
  }

  @Put('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() updateData: UpdateProfileDto
  ) {
    return this.profileService.updateProfile(req.user.id, updateData);
  }

  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() passwordData: ChangePasswordDto
  ) {
    return this.profileService.changePassword(req.user.id, passwordData);
  }
}
```

### File Upload Handling

#### Avatar Upload

```typescript
@Post('upload-avatar')
@UseInterceptors(FileInterceptor('avatar'))
async uploadAvatar(
  @Req() req: Request,
  @UploadedFile() file: Express.Multer.File
) {
  // Validate file type and size
  // Resize and optimize image
  // Store file and update user profile
  return this.profileService.uploadAvatar(req.user.id, file);
}
```

### NGRX State Management

#### Profile State

```typescript
export interface ProfileState {
  profile: UserProfile | null;
  preferences: UserPreferences;
  loading: boolean;
  error: string | null;
}

export const initialState: ProfileState = {
  profile: null,
  preferences: {
    theme: 'system',
    notifications: true,
    language: 'en',
  },
  loading: false,
  error: null,
};
```

#### Profile Actions

```typescript
export const loadProfile = createAction('[Profile] Load Profile');
export const loadProfileSuccess = createAction(
  '[Profile] Load Profile Success',
  props<{ profile: UserProfile }>()
);
export const updateProfile = createAction(
  '[Profile] Update Profile',
  props<{ profile: Partial<UserProfile> }>()
);
```

## Security Considerations

### Password Security

- Password strength validation
- Secure password hashing (bcrypt)
- Rate limiting on password change attempts
- Password history to prevent reuse

### File Upload Security

- File type validation
- Size limits and compression
- Virus scanning (future)
- Secure file storage with access controls

### Data Privacy

- GDPR compliance for data export/deletion
- Secure handling of personal information
- Audit logging for sensitive operations

## Testing

### Unit Tests

```typescript
describe('ProfileFormComponent', () => {
  it('should validate required fields', () => {
    // Test form validation
  });

  it('should submit valid profile data', () => {
    // Test successful submission
  });
});
```

### E2E Tests

```typescript
describe('Profile Settings', () => {
  it('should update user profile', () => {
    // Navigate to profile, update fields, verify changes
  });

  it('should change password', () => {
    // Test password change flow
  });
});
```

## Integration Points

### Authentication System

- JWT token validation for all requests
- User context injection in controllers
- Session management integration

### File Storage Service

- Avatar file storage and retrieval
- CDN integration for fast loading
- Backup and recovery procedures

### Notification System

- Email notifications for security changes
- In-app notifications for profile updates

## Future Enhancements

### Advanced Features

- Social media profile linking
- Profile verification badges
- Advanced privacy controls
- Profile analytics and insights

### Mobile Optimization

- Responsive design improvements
- Mobile-specific UI patterns
- Touch-friendly controls

## Related Documentation

- `AUTHENTICATION_SYSTEM.md` - Authentication integration
- `USER_LIBRARY.md` - User data management
- `REDIS_CACHING.md` - Session and cache management</content>
  **Parameter Name**: `filePath`  
  **Value**: `c:\repos\harmonia\docs\DETAILED_ANNOTATIONS_TOGGLE.md`
