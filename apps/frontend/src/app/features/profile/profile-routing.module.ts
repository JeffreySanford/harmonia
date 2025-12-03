import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProfileComponent } from './profile.component';

const routes: Routes = [
  {
    path: '',
    component: ProfileComponent
  }
];

/**
 * Profile Routing Module
 * 
 * Routes for user profile and settings.
 * 
 * **Routes**:
 * - `/profile` - User profile settings page
 * 
 * **Future Routes**:
 * - `/profile/security` - Security settings (password, 2FA)
 * - `/profile/preferences` - User preferences
 */
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProfileRoutingModule { }
