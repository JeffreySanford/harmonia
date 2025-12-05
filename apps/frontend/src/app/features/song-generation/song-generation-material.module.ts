import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';

/**
 * Material Design modules for Song Generation feature.
 *
 * Provides Material components for narrative-driven song creation forms.
 *
 * **Components Included**:
 * - `MatButtonModule` (3 KB) - Action buttons
 * - `MatButtonToggleModule` (2 KB) - Mode selection toggles
 * - `MatCardModule` (2 KB) - Form container
 * - `MatFormFieldModule` (4 KB) - Form field wrappers
 * - `MatIconModule` (1.5 KB) - UI icons
 * - `MatInputModule` (2.5 KB) - Text inputs (title, lyrics)
 * - `MatSelectModule` (5 KB) - Selectors (genre, style, mood)
 * - `MatSliderModule` (4 KB) - Duration/intensity controls
 *
 * **Total Bundle Size**: ~24 KB
 *
 * **Form Features**:
 * - Song title and description inputs
 * - Genre and style selectors
 * - Lyric input/generation
 * - Duration and mood controls
 * - Mode selection toggles
 *
 * **Usage**: Imported in `SongGenerationModule` for lazy-loaded route.
 *
 * **Tree-Shaking**: Only loaded when user navigates to /generate/song.
 *
 * @see {@link file://./docs/MATERIAL_MODULES.md} for architecture documentation
 */
@NgModule({
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSliderModule,
  ],
  exports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSliderModule,
  ],
})
export class SongGenerationMaterialModule {}
