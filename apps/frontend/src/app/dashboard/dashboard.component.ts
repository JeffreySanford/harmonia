import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { StatusUpdatePayload } from '../interfaces/status-update';


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: false
})
export class DashboardComponent implements OnDestroy, OnInit {
  public jobStatus = { music: 'Unknown', video: 'Unknown', vocal: 'Unknown' };
  private socket?: Socket | null = null;
  private http = inject(HttpClient);

  ngOnInit(): void {
    // Get initial status
    this.refreshJobStatus();
    // Connect to socket for updates
    try {
      this.socket = io('http://localhost:3000');
      this.socket.on('connect', () => console.log('Dashboard socket connected', this.socket?.id));
      this.socket.on('status_update', (payload: StatusUpdatePayload) => {
        if (payload.service === 'music') this.jobStatus.music = payload.status;
        if (payload.service === 'video') this.jobStatus.video = payload.status;
        if (payload.service === 'vocal') this.jobStatus.vocal = payload.status;
      });
    } catch (e) {
      console.warn('Dashboard socket init failed', e);
    }
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private typeStatusResponse(res: unknown): string {
    // permissive but typed handling of backend status response
    const r = (res && typeof res === 'object') ? res as Record<string, unknown> : null;
    const status = (r && typeof r['status'] === 'string') ? r['status'] as string : (r && typeof r['message'] === 'string' ? r['message'] as string : 'OK');
    return status;
  }

  refreshJobStatus() {
    this.http.get('/api/music/status').subscribe({ next: (res) => { this.jobStatus.music = this.typeStatusResponse(res); }, error: () => { this.jobStatus.music = 'Error'; } });
    this.http.get('/api/video/status').subscribe({ next: (res) => { this.jobStatus.video = this.typeStatusResponse(res); }, error: () => { this.jobStatus.video = 'Error'; } });
    this.http.get('/api/vocal/status').subscribe({ next: (res) => { this.jobStatus.vocal = this.typeStatusResponse(res); }, error: () => { this.jobStatus.vocal = 'Error'; } });
  }
}