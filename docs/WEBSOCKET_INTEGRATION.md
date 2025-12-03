# WebSocket Integration Guide

## Overview

Harmonia uses **Socket.IO 4.8.1** for real-time bidirectional communication between frontend and backend. This guide covers WebSocket setup, event patterns, and NGRX integration for Phase 1.

## Architecture

### Frontend (Angular)

- **Socket.IO Client**: Connects to backend WebSocket server
- **WebSocketService**: Manages connection lifecycle and event streams
- **NGRX Integration**: Dispatches actions from WebSocket events

### Backend (NestJS)

- **@nestjs/websockets**: WebSocket gateway decorator support
- **JobsGateway**: Handles job status broadcasts and subscriptions
- **Room-Based Subscriptions**: Per-user and per-job event routing

## Installation

### Frontend Dependencies

```bash
pnpm add -D -w socket.io-client@4.8.1
```

### Backend Dependencies

```bash
pnpm add -D -w @nestjs/websockets@11.1.9 @nestjs/platform-socket.io@11.1.9
```

## Frontend Implementation

### WebSocket Service (`apps/frontend/src/app/services/websocket.service.ts`)

```typescript
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { io, Socket } from 'socket.io-client';
import { Observable, fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppState } from '../store/app.state';
import * as JobsActions from '../store/jobs/jobs.actions';

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

    // Connection events
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

    // Subscribe to job events
    this.setupJobEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.destroy$.next();
    }
  }

  private setupJobEventListeners(): void {
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

    this.getJobCompletedEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.store.dispatch(JobsActions.jobCompleted({ job: event.job }));
      });

    this.getJobFailedEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.store.dispatch(
          JobsActions.jobFailed({ id: event.id, error: event.error })
        );
      });
  }

  // Observable streams for job events
  private getJobStatusUpdates(): Observable<JobStatusEvent> {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent<JobStatusEvent>(this.socket, 'job:status');
  }

  private getJobProgressUpdates(): Observable<JobProgressEvent> {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent<JobProgressEvent>(this.socket, 'job:progress');
  }

  private getJobCompletedEvents(): Observable<JobCompletedEvent> {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent<JobCompletedEvent>(this.socket, 'job:completed');
  }

  private getJobFailedEvents(): Observable<JobFailedEvent> {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent<JobFailedEvent>(this.socket, 'job:failed');
  }

  // Room subscriptions
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
```

### Connecting on Authentication

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs/operators';
import { AppState } from './store/app.state';
import { WebSocketService } from './services/websocket.service';
import * as fromAuth from './store/auth/auth.selectors';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(
    private store: Store<AppState>,
    private websocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    // Connect WebSocket when user logs in
    this.store
      .select(fromAuth.selectAuthToken)
      .pipe(filter((token) => !!token))
      .subscribe((token) => {
        this.websocketService.connect(token!);
        this.websocketService.subscribeToUserJobs();
      });

    // Disconnect WebSocket when user logs out
    this.store
      .select(fromAuth.selectIsAuthenticated)
      .pipe(filter((isAuth) => !isAuth))
      .subscribe(() => {
        this.websocketService.disconnect();
      });
  }

  ngOnDestroy(): void {
    this.websocketService.disconnect();
  }
}
```

## Backend Implementation

### Jobs Gateway (`apps/backend/src/app/gateways/jobs.gateway.ts`)

```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class JobsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(JobsGateway.name);
  private userSockets = new Map<string, Socket>();

  handleConnection(client: Socket): void {
    const token = client.handshake.auth.token;

    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token`);
      client.disconnect();
      return;
    }

    // Validate JWT and extract userId
    const userId = this.extractUserIdFromToken(token);

    if (!userId) {
      this.logger.warn(`Client ${client.id} has invalid token`);
      client.disconnect();
      return;
    }

    this.userSockets.set(userId, client);
    this.logger.log(`Client ${client.id} connected (user: ${userId})`);
  }

  handleDisconnect(client: Socket): void {
    for (const [userId, socket] of this.userSockets.entries()) {
      if (socket.id === client.id) {
        this.userSockets.delete(userId);
        this.logger.log(`Client ${client.id} disconnected (user: ${userId})`);
        break;
      }
    }
  }

  @SubscribeMessage('job:subscribe')
  handleSubscribeToJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket
  ): void {
    const room = `job:${data.jobId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to job ${data.jobId}`);
  }

  @SubscribeMessage('job:unsubscribe')
  handleUnsubscribeFromJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket
  ): void {
    const room = `job:${data.jobId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} unsubscribed from job ${data.jobId}`);
  }

  @SubscribeMessage('jobs:subscribe:user')
  handleSubscribeToUserJobs(@ConnectedSocket() client: Socket): void {
    const token = client.handshake.auth.token;
    const userId = this.extractUserIdFromToken(token);

    if (userId) {
      const room = `user:${userId}:jobs`;
      client.join(room);
      this.logger.log(`Client ${client.id} subscribed to user jobs`);
    }
  }

  @SubscribeMessage('jobs:unsubscribe:user')
  handleUnsubscribeFromUserJobs(@ConnectedSocket() client: Socket): void {
    const token = client.handshake.auth.token;
    const userId = this.extractUserIdFromToken(token);

    if (userId) {
      const room = `user:${userId}:jobs`;
      client.leave(room);
      this.logger.log(`Client ${client.id} unsubscribed from user jobs`);
    }
  }

  // Server-side broadcast methods
  emitJobStatus(jobId: string, status: string): void {
    const room = `job:${jobId}`;
    this.server.to(room).emit('job:status', { id: jobId, status });
    this.logger.debug(`Emitted status update for job ${jobId}: ${status}`);
  }

  emitJobProgress(
    jobId: string,
    progress: {
      current: number;
      total: number;
      percentage: number;
      message: string;
    }
  ): void {
    const room = `job:${jobId}`;
    this.server.to(room).emit('job:progress', { id: jobId, progress });
    this.logger.debug(
      `Emitted progress update for job ${jobId}: ${progress.percentage}%`
    );
  }

  emitJobCompleted(job: Record<string, unknown>): void {
    const jobId = job['id'] as string;
    const userId = job['userId'] as string;
    const jobRoom = `job:${jobId}`;
    const userRoom = `user:${userId}:jobs`;

    this.server.to(jobRoom).to(userRoom).emit('job:completed', { job });
    this.logger.log(`Emitted completion for job ${jobId}`);
  }

  emitJobFailed(jobId: string, userId: string, error: string): void {
    const jobRoom = `job:${jobId}`;
    const userRoom = `user:${userId}:jobs`;

    this.server.to(jobRoom).to(userRoom).emit('job:failed', { id: jobId, error });
    this.logger.log(`Emitted failure for job ${jobId}`);
  }

  private extractUserIdFromToken(token: string): string | null {
    // TODO: Implement JWT validation with @nestjs/jwt
    return 'mock-user-id';
  }
}
```

### Register Gateway in Module

```typescript
import { Module } from '@nestjs/common';
import { JobsGateway } from './gateways/jobs.gateway';

@Module({
  providers: [JobsGateway],
})
export class AppModule {}
```

## Event Types

### Client → Server (Subscriptions)

| Event                     | Payload                | Description                    |
|---------------------------|------------------------|--------------------------------|
| `job:subscribe`           | `{ jobId: string }`    | Subscribe to specific job      |
| `job:unsubscribe`         | `{ jobId: string }`    | Unsubscribe from job           |
| `jobs:subscribe:user`     | (none)                 | Subscribe to all user's jobs   |
| `jobs:unsubscribe:user`   | (none)                 | Unsubscribe from user's jobs   |

### Server → Client (Broadcasts)

| Event           | Payload                                        | Description                   |
|-----------------|------------------------------------------------|-------------------------------|
| `job:status`    | `{ id: string, status: JobStatus }`            | Job status changed            |
| `job:progress`  | `{ id: string, progress: JobProgress }`        | Job progress updated          |
| `job:completed` | `{ job: Job }`                                 | Job completed successfully    |
| `job:failed`    | `{ id: string, error: string }`                | Job failed with error         |
| `connect`       | (built-in)                                     | Socket connected              |
| `disconnect`    | (built-in)                                     | Socket disconnected           |
| `connect_error` | (built-in)                                     | Connection error              |

## Room-Based Broadcasting

### Room Naming Conventions

```typescript
// Job-specific room (all subscribers to that job)
const jobRoom = `job:${jobId}`;

// User-specific room (all jobs for that user)
const userRoom = `user:${userId}:jobs`;

// Admin room (all jobs across system)
const adminRoom = `admin:jobs`;
```

### Broadcasting to Rooms

```typescript
// Broadcast to specific job subscribers
this.server.to(`job:${jobId}`).emit('job:status', { id: jobId, status: 'processing' });

// Broadcast to user's jobs
this.server.to(`user:${userId}:jobs`).emit('job:status', { id: jobId, status: 'completed' });

// Broadcast to multiple rooms
this.server
  .to(`job:${jobId}`)
  .to(`user:${userId}:jobs`)
  .emit('job:completed', { job });
```

## NGRX Integration

### Job Actions for Real-Time Updates

```typescript
// WebSocket connection status
export const realTimeConnectionEstablished = createAction(
  '[Jobs] Real-Time Connection Established'
);

export const realTimeConnectionLost = createAction(
  '[Jobs] Real-Time Connection Lost',
  props<{ error: string }>()
);

// Job status updates (from WebSocket)
export const jobStatusUpdated = createAction(
  '[Jobs] Job Status Updated',
  props<{ id: string; status: JobStatus }>()
);

export const jobProgressUpdated = createAction(
  '[Jobs] Job Progress Updated',
  props<{ id: string; progress: JobProgress }>()
);

export const jobCompleted = createAction(
  '[Jobs] Job Completed',
  props<{ job: Job }>()
);

export const jobFailed = createAction(
  '[Jobs] Job Failed',
  props<{ id: string; error: string }>()
);
```

### Reducer Handling

```typescript
export const jobsReducer = createReducer(
  initialJobsState,

  // Real-time status update
  on(JobsActions.jobStatusUpdated, (state, { id, status }) =>
    jobsAdapter.updateOne(
      { id, changes: { status } },
      state
    )
  ),

  // Real-time progress update
  on(JobsActions.jobProgressUpdated, (state, { id, progress }) =>
    jobsAdapter.updateOne(
      { id, changes: { progress } },
      state
    )
  ),

  // Job completed (full update)
  on(JobsActions.jobCompleted, (state, { job }) =>
    jobsAdapter.updateOne(
      { id: job.id, changes: job },
      state
    )
  ),

  // Job failed
  on(JobsActions.jobFailed, (state, { id, error }) =>
    jobsAdapter.updateOne(
      {
        id,
        changes: {
          status: 'failed',
          result: { error },
        },
      },
      state
    )
  )
);
```

## Authentication

### JWT Token Validation (Backend)

```typescript
import { JwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JobsGateway {
  constructor(private jwtService: JwtService) {}

  private extractUserIdFromToken(token: string): string | null {
    try {
      const payload = this.jwtService.verify(token);
      return payload.sub; // User ID from JWT
    } catch (error) {
      this.logger.error('JWT validation failed', error);
      return null;
    }
  }
}
```

### Sending Token from Frontend

```typescript
this.socket = io('http://localhost:3333', {
  auth: { token: this.authToken },
  transports: ['websocket'],
});
```

## Error Handling

### Connection Errors

```typescript
this.socket.on('connect_error', (error) => {
  console.error('WebSocket connection error:', error);
  this.store.dispatch(
    JobsActions.realTimeConnectionLost({ error: error.message })
  );
});
```

### Reconnection Strategy

```typescript
this.socket = io('http://localhost:3333', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
});

this.socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);
  this.store.dispatch(JobsActions.realTimeConnectionEstablished());
});
```

### Timeout Handling

```typescript
this.socket.timeout(5000).emit('job:subscribe', { jobId }, (err, response) => {
  if (err) {
    console.error('Subscription timeout:', err);
  }
});
```

## Component Usage

### Subscribe to Job Updates

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from '../../store/app.state';
import { WebSocketService } from '../../services/websocket.service';
import * as fromJobs from '../../store/jobs/jobs.selectors';

@Component({
  selector: 'app-job-detail',
  templateUrl: './job-detail.component.html',
})
export class JobDetailComponent implements OnInit, OnDestroy {
  job$!: Observable<Job | null>;
  jobId!: string;

  constructor(
    private store: Store<AppState>,
    private websocketService: WebSocketService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.jobId = this.route.snapshot.params['id'];
    this.job$ = this.store.select(fromJobs.selectJobById(this.jobId));

    // Subscribe to real-time updates for this job
    this.websocketService.subscribeToJob(this.jobId);
  }

  ngOnDestroy(): void {
    // Unsubscribe when leaving component
    this.websocketService.unsubscribeFromJob(this.jobId);
  }
}
```

### Display Real-Time Progress

```html
<div *ngIf="job$ | async as job">
  <h2>{{ job.jobType }} Job</h2>
  <p>Status: {{ job.status }}</p>

  <div *ngIf="job.progress">
    <mat-progress-bar
      mode="determinate"
      [value]="job.progress.percentage">
    </mat-progress-bar>
    <p>{{ job.progress.message }}</p>
    <p>{{ job.progress.current }} / {{ job.progress.total }}</p>
  </div>

  <div *ngIf="job.status === 'completed'">
    <p>✓ Job completed successfully!</p>
    <a [href]="job.result?.outputPath">Download Result</a>
  </div>

  <div *ngIf="job.status === 'failed'" class="error">
    <p>✗ Job failed: {{ job.result?.error }}</p>
  </div>
</div>
```

## Testing

### Frontend Service Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { WebSocketService } from './websocket.service';

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebSocketService, provideMockStore()],
    });
    service = TestBed.inject(WebSocketService);
  });

  it('should connect with token', () => {
    service.connect('test-token');
    expect(service['socket']).toBeTruthy();
  });

  it('should disconnect socket', () => {
    service.connect('test-token');
    service.disconnect();
    expect(service['socket']).toBeNull();
  });
});
```

### Backend Gateway Testing

```typescript
import { Test } from '@nestjs/testing';
import { JobsGateway } from './jobs.gateway';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

describe('JobsGateway', () => {
  let app: INestApplication;
  let client: Socket;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [JobsGateway],
    }).compile();

    app = module.createNestApplication();
    await app.listen(3333);

    client = io('http://localhost:3333', {
      auth: { token: 'test-token' },
    });
  });

  afterAll(async () => {
    client.disconnect();
    await app.close();
  });

  it('should connect client', (done) => {
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      done();
    });
  });

  it('should subscribe to job', (done) => {
    client.emit('job:subscribe', { jobId: 'job-123' });
    // Verify room subscription
    done();
  });
});
```

## Performance Optimization

### Debounce Frequent Updates

```typescript
import { debounceTime } from 'rxjs/operators';

this.getJobProgressUpdates()
  .pipe(
    debounceTime(100), // Update max once per 100ms
    takeUntil(this.destroy$)
  )
  .subscribe((event) => {
    this.store.dispatch(JobsActions.jobProgressUpdated(event));
  });
```

### Selective Room Subscriptions

Only subscribe to jobs actively being viewed:

```typescript
// Subscribe when component mounts
ngOnInit(): void {
  this.websocketService.subscribeToJob(this.jobId);
}

// Unsubscribe when component unmounts
ngOnDestroy(): void {
  this.websocketService.unsubscribeFromJob(this.jobId);
}
```

## Security Best Practices

1. **Always Validate JWT Tokens**: Reject connections without valid tokens
2. **Use HTTPS/WSS in Production**: Encrypt WebSocket traffic
3. **Rate Limiting**: Prevent spam with connection/event rate limits
4. **Room Authorization**: Verify users can only join rooms for their data
5. **Input Validation**: Sanitize all client messages before processing

## Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [RxJS fromEvent](https://rxjs.dev/api/index/function/fromEvent)
- [NGRX Effects](https://ngrx.io/guide/effects)
