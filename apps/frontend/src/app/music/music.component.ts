import { Component, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// No RxJS imports needed for the socket-only flow
import { io, Socket } from 'socket.io-client';

interface StatusUpdatePayload {
  status: string;
  service?: string;
  url?: string;
  file?: string;
  audio_url?: string;
}

@Component({
  selector: 'app-music',
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.scss'],
  standalone: false
})
export class MusicComponent implements OnDestroy {
  public data: Record<string, unknown> | null = null;
  public loading = false;
  public status: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  public message = '';
  public httpStatus: number | null = null;
  public errorDetails: string | null = null;
  public progress = 0;
  public estimatedTime = 10; // seconds
  public lyrics = '';
  public audioUrl: string | null = null;
  public audioPlaying = false;
  private audioEl: HTMLAudioElement | null = null;
  // No polling; if we reintroduce polling later, re-add a subscription here
  private socket?: Socket | null = null;

  private http = inject(HttpClient);

  constructor() {
    console.log('MusicComponent constructed');
    try {
      // Compute a default socket URL:
      // - In local development, the Nest server runs on port 3000 so default to that
      // - Otherwise, rely on the current origin
      const defaultSocketUrl = (typeof window !== 'undefined' && window?.location?.hostname === 'localhost') ? 'http://localhost:3000' : (typeof window !== 'undefined' ? window.location.origin : '');
      this.socket = io(defaultSocketUrl);
      this.socket?.on('connect', () => console.log('Socket connected from constructor', this.socket?.id));
      this.socket?.on('status_update', (payload: StatusUpdatePayload) => this.handleStatusUpdate(payload));
    } catch (err) {
      console.warn('Socket init failed', err);
    }
  }

  sendRequest() {
    console.log('sendRequest called from frontend music component');
    this.loading = true;
    this.status = 'loading';
    this.message = 'Request sent! Waiting for backend...';
    this.httpStatus = null;
    this.errorDetails = null;
    this.progress = 0;
    this.estimatedTime = 10;
    this.audioUrl = null;
    this.audioPlaying = false;
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch (err) { console.warn('Pause audio failed', err); }
      this.audioEl = null;
    }

    // Request a new music generation job via POST /api/music (the Nest server will set the redis key)

    console.log('Sending POST to /api/music');
    this.http.post<{ data: Record<string, unknown>; message: string }>('/api/music', { lyrics: this.lyrics }).subscribe({
      next: (res) => {
        console.log('POST /api/music success:', res);
        this.data = res?.data ?? res;
        this.loading = true;
        this.status = 'loading';
        this.message = 'Request sent; backend now processing the job.';
        this.httpStatus = 200;
        // do not set progress to 100 yet; socket will update it
        // responseStream removed; socket updates will drive UI
      },
      error: (err) => {
        console.log('POST error:', err);
        this.loading = false;
        this.status = 'error';
        this.message = 'Error: Backend did not process the request.';
        this.httpStatus = err.status || null;
        this.errorDetails = err.message || JSON.stringify(err);
      }
    });
    // We'll rely on socket updates which are handled by constructor listener
  }

  private parseStatusToProgress(val: string): number {
    if (!val) return 0;
    if (val.includes(':')) {
      const [, v] = val.split(':');
      const n = parseInt(v, 10);
      if (!isNaN(n)) return Math.max(0, Math.min(100, n));
    }
    // map known keywords
    const map: Record<string, number> = {
      unknown: 0,
      requested: 10,
      queued: 20,
      processing: 50,
      complete: 100,
      done: 100,
      error: 100
    };
    const key = val.toLowerCase();
    return map[key] ?? 0;
  }

  ngOnDestroy(): void {
    // no polling to cleanup
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private handleStatusUpdate(payload: StatusUpdatePayload) {
    const val = payload?.status || 'unknown';
    const numeric = this.parseStatusToProgress(val);
    this.progress = numeric;
    this.loading = !(val.includes('complete') || val.includes('done') || val.includes('error') || numeric >= 100);
    this.status = this.loading ? 'loading' : (val.includes('error') ? 'error' : 'success');
    this.message = `Status: ${payload?.service} = ${val}`;
    // capture audio url if published by the microservice on completion
    const url = payload?.url || payload?.file || payload?.audio_url || null;
    if (url && (val.includes('complete') || val.includes('done'))) {
      this.audioUrl = url;
      try {
        // use the tight-scoped `url` variable (string) to satisfy TypeScript
        this.audioEl = new Audio(url);
      } catch (err) {
        this.audioEl = null;
        console.warn('Failed to create Audio element', err);
      }
    }
    if (!this.loading && this.socket) {
      // keep the socket for other services; do not disconnect automatically
    }
  }

  public togglePlayback() {
    if (!this.audioUrl) return;
    if (!this.audioEl) {
      if (this.audioUrl) {
        try { this.audioEl = new Audio(this.audioUrl); } catch { return; }
      }
    }
    if (!this.audioPlaying) {
      this.audioEl?.play().then(() => this.audioPlaying = true).catch(() => this.audioPlaying = false);
    } else {
      this.audioEl?.pause();
      this.audioPlaying = false;
    }
  }
}