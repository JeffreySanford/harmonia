/**
 * WebSocket Service
 * Real-time communication with Socket.IO
 */

import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { io, Socket } from 'socket.io-client';
import { Observable, fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppState } from '../store/app.state';
import { Job, JobStatus, JobProgress } from '../store/jobs/jobs.state';
import * as JobsActions from '../store/jobs/jobs.actions';

export interface JobStatusEvent {
  id: string;
  status: JobStatus;
}

export interface JobProgressEvent {
  id: string;
  progress: JobProgress;
}

export interface JobCompletedEvent {
  job: Job;
}

export interface JobFailedEvent {
  id: string;
  error: string;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: Socket | null = null;
  private destroy$ = new Subject<void>();

  constructor(private store: Store<AppState>) {}

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io('http://localhost:3333', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.store.dispatch(JobsActions.realTimeConnectionEstablished());
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.store.dispatch(
        JobsActions.realTimeConnectionLost({ error: error.message })
      );
    });

    // Job status updates
    this.getJobStatusUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.store.dispatch(
          JobsActions.jobStatusUpdated({
            id: event.id,
            status: event.status,
          })
        );
      });

    // Job progress updates
    this.getJobProgressUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.store.dispatch(
          JobsActions.jobProgressUpdated({
            id: event.id,
            progress: event.progress,
          })
        );
      });

    // Job completed
    this.getJobCompletedEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.store.dispatch(JobsActions.jobCompleted({ job: event.job }));
      });

    // Job failed
    this.getJobFailedEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.store.dispatch(
          JobsActions.jobFailed({ id: event.id, error: event.error })
        );
      });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.destroy$.next();
    }
  }

  // Observable streams for job events
  private getJobStatusUpdates(): Observable<JobStatusEvent> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    return fromEvent<JobStatusEvent>(this.socket, 'job:status');
  }

  private getJobProgressUpdates(): Observable<JobProgressEvent> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    return fromEvent<JobProgressEvent>(this.socket, 'job:progress');
  }

  private getJobCompletedEvents(): Observable<JobCompletedEvent> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    return fromEvent<JobCompletedEvent>(this.socket, 'job:completed');
  }

  private getJobFailedEvents(): Observable<JobFailedEvent> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    return fromEvent<JobFailedEvent>(this.socket, 'job:failed');
  }

  // Subscribe to specific job updates
  subscribeToJob(jobId: string): void {
    if (this.socket) {
      this.socket.emit('job:subscribe', { jobId });
    }
  }

  unsubscribeFromJob(jobId: string): void {
    if (this.socket) {
      this.socket.emit('job:unsubscribe', { jobId });
    }
  }

  // Subscribe to all user jobs
  subscribeToUserJobs(): void {
    if (this.socket) {
      this.socket.emit('jobs:subscribe:user');
    }
  }

  unsubscribeFromUserJobs(): void {
    if (this.socket) {
      this.socket.emit('jobs:unsubscribe:user');
    }
  }
}
