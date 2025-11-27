import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';

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
      this.socket.on('status_update', (payload: any) => {
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

  refreshJobStatus() {
    this.http.get('/api/music/status').subscribe({ next: (res: any) => { this.jobStatus.music = res?.status || res?.message || 'OK'; }, error: () => { this.jobStatus.music = 'Error'; } });
    this.http.get('/api/video/status').subscribe({ next: (res: any) => { this.jobStatus.video = res?.status || res?.message || 'OK'; }, error: () => { this.jobStatus.video = 'Error'; } });
    this.http.get('/api/vocal/status').subscribe({ next: (res: any) => { this.jobStatus.vocal = res?.status || res?.message || 'OK'; }, error: () => { this.jobStatus.vocal = 'Error'; } });
  }
}