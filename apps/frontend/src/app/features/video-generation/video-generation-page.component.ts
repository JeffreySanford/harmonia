import { Component } from '@angular/core';

@Component({
  selector: 'app-video-generation-page',
  standalone: false,
  templateUrl: './video-generation-page.component.html',
  styleUrl: './video-generation-page.component.scss',
})
export class VideoGenerationPageComponent {
  title = 'Video Generation';
  duration = 10;
  selectedResolution = '1080p';
  estimatedCompletionTime = '2-3 minutes';
  showEstimate = true;

  // Estimation factors (seconds of processing per second of video)
  private readonly processingRatios = {
    '720p': 8,   // 8 seconds to process 1 second of 720p video
    '1080p': 12, // 12 seconds to process 1 second of 1080p video
    '4k': 25     // 25 seconds to process 1 second of 4K video
  };

  formatDurationLabel = (value: number): string => {
    return `${value}s`;
  };

  onDurationChange(value: number): void {
    this.duration = value;
    this.calculateEstimatedTime();
  }

  onResolutionChange(resolution: string): void {
    this.selectedResolution = resolution;
    this.calculateEstimatedTime();
  }

  private calculateEstimatedTime(): void {
    const ratio = this.processingRatios[this.selectedResolution as keyof typeof this.processingRatios] || 12;
    const totalSeconds = this.duration * ratio;
    
    if (totalSeconds < 60) {
      this.estimatedCompletionTime = `${totalSeconds} seconds`;
    } else {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      if (seconds === 0) {
        this.estimatedCompletionTime = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        this.estimatedCompletionTime = `${minutes}m ${seconds}s`;
      }
    }

    // Add range for uncertainty
    const minTime = Math.floor(totalSeconds * 0.8);
    const maxTime = Math.ceil(totalSeconds * 1.2);
    
    if (minTime < 60 && maxTime < 60) {
      this.estimatedCompletionTime = `${minTime}-${maxTime} seconds`;
    } else {
      const minMinutes = Math.floor(minTime / 60);
      const maxMinutes = Math.ceil(maxTime / 60);
      this.estimatedCompletionTime = `${minMinutes}-${maxMinutes} minute${maxMinutes > 1 ? 's' : ''}`;
    }
  }
}
