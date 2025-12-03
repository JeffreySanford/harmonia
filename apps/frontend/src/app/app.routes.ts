import { Route } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { guestGuard } from './guards/guest.guard';

/**
 * Application Routes
 * 
 * Route configuration with lazy-loaded modules and guards:
 * - `/` - Landing page (guests only)
 * - `/library` - User's music library (auth required)
 * - `/profile` - User profile settings (auth required)
 * - `/admin` - Admin dashboard (admin role required)
 * - `/generate/*` - Music/song/video generation features
 * - `/edit/*` - Video editing features
 * 
 * **Guards**:
 * - `guestGuard` - Prevents authenticated users from accessing guest pages
 * - `authGuard` - Protects authenticated routes
 * - `adminGuard` - Restricts admin-only access
 * 
 * @see {@link file://./guards/README.md} for guard documentation
 */
export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'library',
    loadChildren: () =>
      import('./features/library/library.module').then((m) => m.LibraryModule),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.module').then((m) => m.ProfileModule),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.module').then((m) => m.AdminModule),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'generate/song',
    loadChildren: () =>
      import('./features/song-generation/song-generation.module').then(
        (m) => m.SongGenerationModule
      ),
  },
  {
    path: 'generate/music',
    loadChildren: () =>
      import('./features/music-generation/music-generation.module').then(
        (m) => m.MusicGenerationModule
      ),
  },
  {
    path: 'generate/video',
    loadChildren: () =>
      import('./features/video-generation/video-generation.module').then(
        (m) => m.VideoGenerationModule
      ),
  },
  {
    path: 'edit/video',
    loadChildren: () =>
      import('./features/video-editing/video-editing.module').then(
        (m) => m.VideoEditingModule
      ),
  },
  {
    path: '**',
    redirectTo: '/generate/song',
  },
];
