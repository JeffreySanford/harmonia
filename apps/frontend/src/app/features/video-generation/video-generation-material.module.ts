import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';

/**
 * Material Design modules for Video Generation feature.
 * 
 * Provides Material components for text-to-video generation with intelligent
 * completion time estimation based on duration and resolution.
 * 
 * **Components Included**:
 * - `MatButtonModule` (3 KB) - Generate and action buttons
 * - `MatCardModule` (2 KB) - Form container
 * - `MatFormFieldModule` (4 KB) - Form field wrappers
 * - `MatIconModule` (1.5 KB) - UI and status icons
 * - `MatInputModule` (2.5 KB) - Text inputs (title, scene description)
 * - `MatSelectModule` (5 KB) - Style and resolution selectors
 * - `MatSliderModule` (4 KB) - **Enhanced duration slider with tick marks (5-60s)**
 * 
 * **Total Bundle Size**: ~22 KB
 * 
 * **Special Features**:
 * - Duration slider with tick marks (5-second intervals)
 * - Real-time completion time estimation:
 *   - 720p: 8 seconds per video second
 *   - 1080p: 12 seconds per video second
 *   - 4K: 25 seconds per video second
 * - ±20% uncertainty range display
 * - Resolution-aware processing estimates
 * 
 * **Usage**: Imported in `VideoGenerationModule` for lazy-loaded route.
 * 
 * **Tree-Shaking**: Only loaded when user navigates to /generate/video.
 * 
 * @see {@link file://./docs/MATERIAL_MODULES.md} for architecture documentation
 * @see {@link VideoGenerationPageComponent.calculateEstimatedTime} for estimation logic
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
export class VideoGenerationMaterialModule { }
