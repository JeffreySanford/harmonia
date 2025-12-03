import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileRoutingModule } from './profile-routing.module';
import { ProfileComponent } from './profile.component';
import { ProfileMaterialModule } from './profile-material.module';

/**
 * Profile Feature Module
 * 
 * Manages user profile and account settings:
 * - View/edit profile information
 * - Change password
 * - Email verification
 * - Avatar upload
 * - Account preferences
 * 
 * **State Management**: Uses NGRX AuthState for user data
 */
@NgModule({
  declarations: [
    ProfileComponent
  ],
  imports: [
    CommonModule,
    ProfileRoutingModule,
    ProfileMaterialModule
  ]
})
export class ProfileModule { }
