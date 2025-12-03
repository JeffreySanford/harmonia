import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';

/**
 * Material Design modules for Video Editing feature.
 * 
 * Provides Material components for video editing timeline interface including
 * storyboard, timeline controls, and scene management.
 * 
 * **Components Included**:
 * - `MatButtonModule` (3 KB) - Timeline control buttons (play, pause, stop)
 * - `MatCardModule` (2 KB) - Storyboard and timeline containers
 * - `MatDividerModule` (0.5 KB) - **Section separators** - Unique to this module
 * - `MatIconModule` (1.5 KB) - Timeline and control icons
 * - `MatListModule` (3 KB) - **Scene list** - Unique to this module
 * - `MatToolbarModule` (2 KB) - **Timeline header** - Unique to this module
 * 
 * **Total Bundle Size**: ~12 KB (smallest Material module)
 * 
 * **Unique Features**:
 * - Toolbar component for timeline header with timecode display
 * - List component for scene/clip management
 * - Divider component for separating storyboard/timeline/scenes sections
 * - Specialized for video editing timeline UI
 * 
 * **Timeline Interface**:
 * - Play/pause/stop controls
 * - Timecode display (00:00 / 00:00)
 * - Scene list with add/remove functionality
 * - Storyboard preview area
 * 
 * **Usage**: Imported in `VideoEditingModule` for lazy-loaded route.
 * 
 * **Tree-Shaking**: Only loaded when user navigates to /edit/video.
 * 
 * @see {@link file://./docs/MATERIAL_MODULES.md} for architecture documentation
 */
@NgModule({
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatToolbarModule,
  ],
  exports: [
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatToolbarModule,
  ]
})
export class VideoEditingMaterialModule { }
