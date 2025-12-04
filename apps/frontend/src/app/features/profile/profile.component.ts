import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { AppState } from '../../store/app.state';
import { UserProfile } from '../../services/profile.service';
import * as ProfileActions from '../../store/profile/profile.state';
import * as ProfileSelectors from '../../store/profile/profile.selectors';
import { ChangePasswordDialogComponent } from './change-password-dialog/change-password-dialog.component';

/**
 * Profile Component
 *
 * User profile settings and account management with avatar upload, password change, and preferences.
 *
 * @see {@link file://./docs/USER_LIBRARY.md} for profile management specification
 */
@Component({
  selector: 'harmonia-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false,
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store<AppState>);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();

  // Observables
  profile$: Observable<UserProfile | null> = this.store.select(
    ProfileSelectors.selectProfile
  );
  loading$: Observable<boolean> = this.store.select(
    ProfileSelectors.selectProfileLoading
  );
  error$: Observable<string | null> = this.store.select(
    ProfileSelectors.selectProfileError
  );

  // Forms
  profileForm!: FormGroup;
  preferencesForm!: FormGroup;

  // Avatar upload
  selectedAvatar: File | null = null;
  avatarPreview: string | null = null;

  // Theme options
  themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto (System)' },
  ];

  ngOnInit(): void {
    // Initialize forms
    this.initializeForms();

    // Load profile data
    this.store.dispatch(ProfileActions.loadProfile());

    // Subscribe to profile changes
    this.profile$.pipe(takeUntil(this.destroy$)).subscribe((profile) => {
      if (profile) {
        this.updateForms(profile);
      }
    });

    // Listen for errors
    this.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
      if (error) {
        this.snackBar.open(error, 'Close', { duration: 5000 });
        this.store.dispatch(ProfileActions.clearError());
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onProfileSubmit(): void {
    if (this.profileForm.valid) {
      const profileData = this.profileForm.value;
      this.store.dispatch(
        ProfileActions.updateProfile({
          profile: {
            displayName: profileData.displayName,
            bio: profileData.bio,
          },
        })
      );
    }
  }

  onPreferencesSubmit(): void {
    if (this.preferencesForm.valid) {
      const preferencesData = this.preferencesForm.value;
      this.store.dispatch(
        ProfileActions.updateProfile({
          profile: {
            preferences: preferencesData,
          },
        })
      );
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedAvatar = input.files[0] || null;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.avatarPreview = e.target?.result as string;
      };
      if (this.selectedAvatar) {
        reader.readAsDataURL(this.selectedAvatar);
      }
    }
  }

  onAvatarUpload(): void {
    if (this.selectedAvatar) {
      this.store.dispatch(
        ProfileActions.uploadAvatar({ avatar: this.selectedAvatar })
      );
      this.selectedAvatar = null;
      this.avatarPreview = null;
    }
  }

  cancelAvatarUpload(): void {
    this.selectedAvatar = null;
    this.avatarPreview = null;
  }

  openChangePasswordDialog(): void {
    const dialogRef = this.dialog.open(ChangePasswordDialogComponent, {
      width: '400px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.store.dispatch(
          ProfileActions.changePassword({
            currentPassword: result.currentPassword,
            newPassword: result.newPassword,
          })
        );
      }
    });
  }

  onDeleteAccount(): void {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.'
    );

    if (confirmed) {
      this.store.dispatch(ProfileActions.deleteAccount());
    }
  }

  getStats(profile: UserProfile) {
    return [
      { label: 'Total Songs', value: profile.stats.totalSongs },
      { label: 'Total Plays', value: profile.stats.totalPlays },
      { label: 'Total Downloads', value: profile.stats.totalDownloads },
      {
        label: 'Member Since',
        value: new Date(profile.stats.joinedDate).toLocaleDateString(),
      },
    ];
  }

  private initializeForms(): void {
    this.profileForm = this.fb.group({
      displayName: ['', [Validators.maxLength(50)]],
      bio: ['', [Validators.maxLength(500)]],
    });

    this.preferencesForm = this.fb.group({
      theme: ['light', Validators.required],
      notifications: this.fb.group({
        email: [true],
        push: [false],
        libraryUpdates: [true],
      }),
      privacy: this.fb.group({
        profileVisibility: ['public', Validators.required],
        libraryVisibility: ['public', Validators.required],
      }),
    });
  }

  private updateForms(profile: UserProfile): void {
    this.profileForm.patchValue({
      displayName: profile.displayName || '',
      bio: profile.bio || '',
    });

    this.preferencesForm.patchValue(profile.preferences);
  }
}
