import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';

/**
 * Material Design modules for Music Generation feature.
 * 
 * Provides Material components for music generation forms with BPM control.
 * 
 * **Components Included**:
 * - `MatButtonModule` (3 KB) - Action buttons (Generate, Clear, etc.)
 * - `MatCardModule` (2 KB) - Form container cards
 * - `MatFormFieldModule` (4 KB) - Form field wrappers
 * - `MatIconModule` (1.5 KB) - Icons in buttons and labels
 * - `MatInputModule` (2.5 KB) - Text input fields (title, description)
 * - `MatSelectModule` (5 KB) - Dropdown selectors (genre, mood)
 * - `MatSliderModule` (4 KB) - **BPM range slider (60-180)** - Unique to this module
 * 
 * **Total Bundle Size**: ~23 KB
 * 
 * **Unique Features**:
 * - BPM slider for tempo control (60-180 range)
 * - Discrete steps with tick marks
 * 
 * **Usage**: Imported in `MusicGenerationModule` for lazy-loaded route.
 * 
 * **Tree-Shaking**: Only loaded when user navigates to /generate/music.
 * 
 * @see {@link file://./docs/MATERIAL_MODULES.md} for architecture documentation
 */
@NgModule({
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
  ],
  exports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
  ]
})
export class MusicGenerationMaterialModule { }
