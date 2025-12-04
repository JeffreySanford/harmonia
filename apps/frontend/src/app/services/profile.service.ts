/**
 * Profile Service
 * HTTP client for profile API endpoints
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: {
      email: boolean;
      push: boolean;
      libraryUpdates: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private';
      libraryVisibility: 'public' | 'private' | 'followers';
    };
  };
  stats: {
    totalSongs: number;
    totalPlays: number;
    totalDownloads: number;
    joinedDate: string;
    lastActive: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  preferences?: Partial<UserProfile['preferences']>;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UploadAvatarRequest {
  avatar: File;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly apiUrl = 'http://localhost:3000/api/profile';
  private readonly http = inject(HttpClient);

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl);
  }

  updateProfile(profile: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.apiUrl, profile);
  }

  changePassword(
    passwords: ChangePasswordRequest
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/password`,
      passwords
    );
  }

  uploadAvatar(avatarData: UploadAvatarRequest): Observable<UserProfile> {
    const formData = new FormData();
    formData.append('avatar', avatarData.avatar);

    return this.http.post<UserProfile>(`${this.apiUrl}/avatar`, formData);
  }

  deleteAccount(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(this.apiUrl);
  }
}
