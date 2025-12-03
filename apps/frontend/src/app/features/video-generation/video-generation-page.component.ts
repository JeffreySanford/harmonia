import { Component } from '@angular/core';

/**
 * Video Generation Page Component
 * 
 * Provides an interface for generating videos from text descriptions with:
 * - Scene composition controls
 * - Style transfer options (realistic, cartoon, anime, abstract, cinematic)
 * - Resolution selection (720p, 1080p, 4K)
 * - Enhanced duration slider with tick marks (5-60 seconds)
 * - **Intelligent completion time estimation** based on duration and resolution
 * 
 * ## Completion Time Estimation
 * 
 * The component calculates estimated generation time using empirical processing ratios:
 * - **720p**: 8 seconds to process 1 second of video
 * - **1080p**: 12 seconds to process 1 second of video
 * - **4K**: 25 seconds to process 1 second of video
 * 
 * The estimation includes a ±20% uncertainty range to account for system variability.
 * 
 * ### Example Calculations:
 * ```
 * 10-second 1080p video:
 *   Base time: 10s × 12 = 120 seconds (2 minutes)
 *   With uncertainty: 96-144 seconds (1.6-2.4 minutes)
 * 
 * 30-second 4K video:
 *   Base time: 30s × 25 = 750 seconds (12.5 minutes)
 *   With uncertainty: 600-900 seconds (10-15 minutes)
 * ```
 * 
 * ## Material Components
 * Uses `VideoGenerationMaterialModule` for Material Design components.
 * 
 * @see {@link VideoGenerationMaterialModule} for Material component dependencies
 * @see {@link calculateEstimatedTime} for estimation algorithm
 */
@Component({
  selector: 'app-video-generation-page',
  standalone: false,
  templateUrl: './video-generation-page.component.html',
  styleUrl: './video-generation-page.component.scss',
})
export class VideoGenerationPageComponent {
  title = 'Video Generation';
  
  /** Current video duration in seconds (5-60) */
  duration = 10;
  
  /** Selected video resolution (720p, 1080p, or 4k) */
  selectedResolution = '1080p';
  
  /** Estimated completion time string with uncertainty range */
  estimatedCompletionTime = '2-3 minutes';
  
  /** Whether to show the detailed generation estimate panel */
  showEstimate = true;

  /**
   * Processing time ratios (seconds of processing per second of video).
   * 
   * These ratios are empirically determined based on typical GPU performance
   * for video generation tasks. Higher resolutions require significantly more
   * processing time due to increased pixel count and model complexity.
   * 
   * @private
   */
  private readonly processingRatios = {
    '720p': 8,   // HD: 1280×720 = 921,600 pixels
    '1080p': 12, // Full HD: 1920×1080 = 2,073,600 pixels (2.25× 720p)
    '4k': 25     // Ultra HD: 3840×2160 = 8,294,400 pixels (4× 1080p)
  };

  /**
   * Formats duration value for slider display.
   * 
   * @param value - Duration in seconds
   * @returns Formatted string with 's' suffix (e.g., "10s")
   */
  formatDurationLabel = (value: number): string => {
    return `${value}s`;
  };

  /**
   * Handles duration slider changes and recalculates estimated time.
   * 
   * @param value - New duration value in seconds (5-60)
   */
  onDurationChange(value: number): void {
    this.duration = value;
    this.calculateEstimatedTime();
  }

  /**
   * Handles resolution dropdown changes and recalculates estimated time.
   * 
   * @param resolution - Selected resolution (720p, 1080p, or 4k)
   */
  onResolutionChange(resolution: string): void {
    this.selectedResolution = resolution;
    this.calculateEstimatedTime();
  }

  /**
   * Calculates estimated video generation completion time.
   * 
   * Uses the current duration and resolution to estimate processing time
   * with a ±20% uncertainty range. The calculation:
   * 
   * 1. Gets processing ratio for selected resolution
   * 2. Multiplies duration by ratio to get base processing time
   * 3. Applies ±20% for min/max range
   * 4. Formats as human-readable string (seconds or minutes)
   * 
   * ### Algorithm:
   * ```
   * baseTime = duration × processingRatio
   * minTime = baseTime × 0.8  (20% faster)
   * maxTime = baseTime × 1.2  (20% slower)
   * ```
   * 
   * ### Format Rules:
   * - Under 60 seconds: "40-48 seconds"
   * - 60+ seconds: "2-3 minutes" or "10-15 minutes"
   * - Rounds to nearest second/minute for readability
   * 
   * @private
   */
  private calculateEstimatedTime(): void {
    const ratio = this.processingRatios[this.selectedResolution as keyof typeof this.processingRatios] || 12;
    const totalSeconds = this.duration * ratio;
    
    // Calculate uncertainty range (±20%)
    const minTime = Math.floor(totalSeconds * 0.8);
    const maxTime = Math.ceil(totalSeconds * 1.2);
    
    // Format as seconds or minutes
    if (minTime < 60 && maxTime < 60) {
      this.estimatedCompletionTime = `${minTime}-${maxTime} seconds`;
    } else {
      const minMinutes = Math.floor(minTime / 60);
      const maxMinutes = Math.ceil(maxTime / 60);
      this.estimatedCompletionTime = `${minMinutes}-${maxMinutes} minute${maxMinutes > 1 ? 's' : ''}`;
    }
  }
}
