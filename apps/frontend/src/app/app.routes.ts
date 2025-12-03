import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/generate/song',
    pathMatch: 'full',
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
