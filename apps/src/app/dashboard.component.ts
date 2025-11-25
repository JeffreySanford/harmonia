import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from './api.service';
import { interval, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

interface StatusResponse {
  message: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  musicStatus = '';
  videoStatus = '';
  vocalStatus = '';
  jobStatus: { music: string; video: string; vocal: string } = { music: '', video: '', vocal: '' };

  api = inject(ApiService);
  private pollingSubscription: Subscription | null = null;

  ngOnInit(): void {
    // Initial fetch
    this.refreshJobStatus();
    // Poll job status every 5 seconds
    this.pollingSubscription = interval(5000).subscribe(() => {
      this.refreshJobStatus();
    });
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  getMusicStatus(): void {
    this.api.http.get('/api/music')
      .pipe(map(res => res as StatusResponse))
      .subscribe({
        next: (res) => {
          this.musicStatus = res.message;
        },
        error: () => {
          this.musicStatus = 'Error fetching music status';
        }
      });
  }

  getVideoStatus(): void {
    this.api.http.get('/api/video')
      .pipe(map(res => res as StatusResponse))
      .subscribe({
        next: (res) => {
          this.videoStatus = res.message;
        },
        error: () => {
          this.videoStatus = 'Error fetching video status';
        }
      });
  }

  getVocalStatus(): void {
    this.api.http.get('/api/vocal')
      .pipe(map(res => res as StatusResponse))
      .subscribe({
        next: (res) => {
          this.vocalStatus = res.message;
        },
        error: () => {
          this.vocalStatus = 'Error fetching vocal status';
        }
      });
  }

  refreshJobStatus(): void {
    this.api.http.get('/api/music')
      .pipe(map(res => res as StatusResponse))
      .subscribe({
        next: (res) => {
          this.jobStatus.music = res.message;
        },
        error: () => {
          this.jobStatus.music = 'Error';
        }
      });
    this.api.http.get('/api/video')
      .pipe(map(res => res as StatusResponse))
      .subscribe({
        next: (res) => {
          this.jobStatus.video = res.message;
        },
        error: () => {
          this.jobStatus.video = 'Error';
        }
      });
    this.api.http.get('/api/vocal')
      .pipe(map(res => res as StatusResponse))
      .subscribe({
        next: (res) => {
          this.jobStatus.vocal = res.message;
        },
        error: () => {
          this.jobStatus.vocal = 'Error';
        }
      });
  }

  requestMusic(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const params = (form.elements.namedItem('musicParams') as HTMLInputElement).value;
    // For now, just call getMusicStatus to start
    this.getMusicStatus();
  }

  requestVideo(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const params = (form.elements.namedItem('videoParams') as HTMLInputElement).value;
    this.getVideoStatus();
  }

  requestVocal(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const params = (form.elements.namedItem('vocalParams') as HTMLInputElement).value;
    this.getVocalStatus();
  }
