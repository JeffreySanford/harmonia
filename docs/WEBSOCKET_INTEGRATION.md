# WebSocket Integration Guide

## Overview

Harmonia uses **Socket.IO 4.8.1** for real-time bidirectional communication between frontend and backend during the song generation pipeline. This guide covers the sophisticated WebSocket implementation for multi-stage AI generation progress tracking, real-time status updates, and collaborative features.

## Architecture

### Multi-Stage Song Generation Pipeline

The WebSocket system supports Harmonia's two-stage AI pipeline:

**Stage 1 - Metadata Generation (Ollama)**:

- Real-time progress for LLM inference
- Token generation tracking
- Model loading status

**Stage 2 - Audio Synthesis (MusicGen)**:

- Audio generation progress (0-100%)
- Multi-instrument rendering status
- Post-processing updates

### Event-Driven Architecture

- **Room-based subscriptions**: Per-user and per-generation-job rooms
- **Typed events**: Strongly-typed WebSocket events with validation
- **Progress streaming**: Real-time percentage updates with status messages
- **Error propagation**: Immediate error broadcasting with recovery options
- **Cancellation support**: User-initiated generation cancellation

### Frontend (Angular)

- **WebSocketService**: Manages connection lifecycle and event streams
- **Progress tracking components**: Real-time UI updates for generation status
- **NGRX integration**: WebSocket events dispatch Redux actions
- **Error handling**: Automatic reconnection and user notifications

### Backend (NestJS)

- **SongGenerationGateway**: Specialized gateway for song generation events
- **Progress broadcasting**: Structured progress events with metadata
- **Room management**: User-specific and generation-specific rooms
- **Authentication**: JWT-based room access control

## WebSocket Architecture Overview

### Event-Driven Architecture

- **Room-based subscriptions**: Per-user and per-generation-job rooms
- **Typed events**: Strongly-typed WebSocket events with validation
- **Progress streaming**: Real-time percentage updates with status messages
- **Error propagation**: Immediate error broadcasting with recovery options
- **Cancellation support**: User-initiated generation cancellation

### Frontend Architecture (Angular)

- **WebSocketService**: Manages connection lifecycle and event streams
- **Progress tracking components**: Real-time UI updates for generation status
- **NGRX integration**: WebSocket events dispatch Redux actions
- **Error handling**: Automatic reconnection and user notifications

### Backend Architecture (NestJS)

- **SongGenerationGateway**: Specialized gateway for song generation events
- **Progress broadcasting**: Structured progress events with metadata
- **Room management**: User-specific and generation-specific rooms
- **Authentication**: JWT-based room access control

## Installation

### Frontend Dependencies

```bash
pnpm add -D -w socket.io-client@4.8.1
```

### Backend Dependencies

```bash
pnpm add -D -w @nestjs/websockets@11.1.9 @nestjs/platform-socket.io@11.1.9
```

## WebSocket Events Specification

### Song Generation Events

#### Metadata Generation Phase

```typescript
// Event: 'metadata-generation-started'
interface MetadataGenerationStartedEvent {
  generationId: string;
  userId: string;
  narrative: string;
  timestamp: Date;
  model: string; // 'deepseek-coder' | 'minstral3'
}

// Event: 'metadata-generation-progress'
interface MetadataGenerationProgressEvent {
  generationId: string;
  progress: number; // 0-100
  status: string; // 'Analyzing narrative...', 'Generating title...', 'Creating lyrics...'
  currentStep: 'analysis' | 'title' | 'lyrics' | 'genre' | 'mood';
  tokensGenerated?: number;
}

// Event: 'metadata-generation-complete'
interface MetadataGenerationCompleteEvent {
  generationId: string;
  metadata: {
    title: string;
    lyrics: string;
    genre: string;
    mood: string[];
    syllableCount: number;
    wordCount: number;
  };
  duration: number; // Estimated generation time in ms
}
```

#### Audio Generation Phase

```typescript
// Event: 'audio-generation-started'
interface AudioGenerationStartedEvent {
  generationId: string;
  songId: string;
  instruments: Instrument[];
  duration: number; // Target song length in seconds
  bpm: number;
}

// Event: 'audio-generation-progress'
interface AudioGenerationProgressEvent {
  generationId: string;
  progress: number; // 0-100
  status: string; // 'Loading MusicGen model...', 'Rendering instruments...', 'Mixing audio...'
  currentInstrument?: string; // Currently rendering instrument name
  instrumentsCompleted: number;
  totalInstruments: number;
}

// Event: 'audio-generation-complete'
interface AudioGenerationCompleteEvent {
  generationId: string;
  songId: string;
  audioUrl: string; // Download URL for generated audio
  duration: number; // Actual generated length in seconds
  fileSize: number; // File size in bytes
  checksum: string; // SHA256 checksum for verification
}
```

#### Error and Control Events

```typescript
// Event: 'generation-error'
interface GenerationErrorEvent {
  generationId: string;
  error: {
    code: string; // 'OLLAMA_UNAVAILABLE', 'MUSICGEN_ERROR', etc.
    message: string;
    details?: any;
    recoverable: boolean; // Can user retry?
  };
  stage: 'metadata' | 'audio';
}

// Event: 'generation-cancelled'
interface GenerationCancelledEvent {
  generationId: string;
  reason: 'user_cancelled' | 'timeout' | 'system_error';
  cancelledAt: Date;
}

// Event: 'generation-timeout'
interface GenerationTimeoutEvent {
  generationId: string;
  stage: 'metadata' | 'audio';
  timeoutAfter: number; // Timeout duration in seconds
}
```

## Frontend Implementation

### WebSocket Service

```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: Socket | null = null;
  private connection$ = new BehaviorSubject<boolean>(false);
  private generationRooms = new Set<string>();

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io('http://localhost:3333', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupConnectionEvents();
    this.setupGenerationEvents();
  }

  // Join generation-specific room
  joinGenerationRoom(generationId: string): void {
    if (this.socket && !this.generationRooms.has(generationId)) {
      this.socket.emit('join-generation', generationId);
      this.generationRooms.add(generationId);
    }
  }

  // Leave generation room
  leaveGenerationRoom(generationId: string): void {
    if (this.socket && this.generationRooms.has(generationId)) {
      this.socket.emit('leave-generation', generationId);
      this.generationRooms.delete(generationId);
    }
  }

  // Cancel generation
  cancelGeneration(generationId: string): void {
    if (this.socket) {
      this.socket.emit('cancel-generation', { generationId });
    }
  }

  private setupConnectionEvents(): void {
    this.socket.on('connect', () => {
      this.connection$.next(true);
      console.log('WebSocket connected for song generation');
    });

    this.socket.on('disconnect', (reason) => {
      this.connection$.next(false);
      console.log('WebSocket disconnected:', reason);
      this.generationRooms.clear();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.connection$.next(false);
    });
  }

  private setupGenerationEvents(): void {
    // Metadata generation events
    this.socket.on(
      'metadata-generation-started',
      (event: MetadataGenerationStartedEvent) => {
        this.store.dispatch(
          SongGenerationActions.metadataGenerationStarted({ event })
        );
      }
    );

    this.socket.on(
      'metadata-generation-progress',
      (event: MetadataGenerationProgressEvent) => {
        this.store.dispatch(
          SongGenerationActions.metadataGenerationProgress({ event })
        );
      }
    );

    this.socket.on(
      'metadata-generation-complete',
      (event: MetadataGenerationCompleteEvent) => {
        this.store.dispatch(
          SongGenerationActions.metadataGenerationComplete({ event })
        );
      }
    );

    // Audio generation events
    this.socket.on(
      'audio-generation-started',
      (event: AudioGenerationStartedEvent) => {
        this.store.dispatch(
          SongGenerationActions.audioGenerationStarted({ event })
        );
      }
    );

    this.socket.on(
      'audio-generation-progress',
      (event: AudioGenerationProgressEvent) => {
        this.store.dispatch(
          SongGenerationActions.audioGenerationProgress({ event })
        );
      }
    );

    this.socket.on(
      'audio-generation-complete',
      (event: AudioGenerationCompleteEvent) => {
        this.store.dispatch(
          SongGenerationActions.audioGenerationComplete({ event })
        );
      }
    );

    // Error and control events
    this.socket.on('generation-error', (event: GenerationErrorEvent) => {
      this.store.dispatch(SongGenerationActions.generationError({ event }));
    });

    this.socket.on(
      'generation-cancelled',
      (event: GenerationCancelledEvent) => {
        this.store.dispatch(
          SongGenerationActions.generationCancelled({ event })
        );
      }
    );
  }

  // Observable streams for components
  getMetadataProgress(
    generationId: string
  ): Observable<MetadataGenerationProgressEvent> {
    return fromEvent(this.socket, 'metadata-generation-progress').pipe(
      filter(
        (event: MetadataGenerationProgressEvent) =>
          event.generationId === generationId
      )
    );
  }

  getAudioProgress(
    generationId: string
  ): Observable<AudioGenerationProgressEvent> {
    return fromEvent(this.socket, 'audio-generation-progress').pipe(
      filter(
        (event: AudioGenerationProgressEvent) =>
          event.generationId === generationId
      )
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.generationRooms.clear();
    }
  }
}
```

### Progress Tracking Components

```typescript
// generation-progress.component.ts
@Component({
  selector: 'app-generation-progress',
  template: `
    <div class="progress-container">
      <mat-progress-bar
        [value]="progress"
        [mode]="progress < 100 ? 'indeterminate' : 'determinate'"
      >
      </mat-progress-bar>

      <div class="progress-info">
        <span class="status">{{ status }}</span>
        <span class="percentage">{{ progress }}%</span>
      </div>

      <div class="stage-info" *ngIf="currentStage">
        <span class="stage">Stage: {{ currentStage }}</span>
        <span class="instrument" *ngIf="currentInstrument">
          Instrument: {{ currentInstrument }}
        </span>
      </div>

      <button
        mat-raised-button
        color="warn"
        (click)="cancelGeneration()"
        *ngIf="canCancel"
      >
        Cancel Generation
      </button>
    </div>
  `,
})
export class GenerationProgressComponent implements OnInit, OnDestroy {
  @Input() generationId!: string;

  progress = 0;
  status = 'Initializing...';
  currentStage?: string;
  currentInstrument?: string;
  canCancel = true;

  private destroy$ = new Subject<void>();

  constructor(
    private websocketService: WebSocketService,
    private store: Store<AppState>
  ) {}

  ngOnInit(): void {
    // Join generation room
    this.websocketService.joinGenerationRoom(this.generationId);

    // Subscribe to progress updates
    this.websocketService
      .getMetadataProgress(this.generationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.progress = event.progress;
        this.status = event.status;
        this.currentStage = event.currentStep;
      });

    this.websocketService
      .getAudioProgress(this.generationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.progress = event.progress;
        this.status = event.status;
        this.currentInstrument = event.currentInstrument;
        this.currentStage = 'audio';
      });
  }

  cancelGeneration(): void {
    this.websocketService.cancelGeneration(this.generationId);
  }

  ngOnDestroy(): void {
    this.websocketService.leaveGenerationRoom(this.generationId);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Backend Implementation

### Song Generation Gateway

```typescript
// song-generation.gateway.ts
@Injectable()
export class SongGenerationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SongGenerationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly songGenerationService: SongGenerationService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;

      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (error) {
      client.disconnect();
      this.logger.error(`Connection rejected: ${error.message}`);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up any active generation subscriptions
  }

  @SubscribeMessage('join-generation')
  handleJoinGeneration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string }
  ): void {
    const roomName = `generation-${data.generationId}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined generation room: ${roomName}`);
  }

  @SubscribeMessage('leave-generation')
  handleLeaveGeneration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string }
  ): void {
    const roomName = `generation-${data.generationId}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left generation room: ${roomName}`);
  }

  @SubscribeMessage('cancel-generation')
  async handleCancelGeneration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string }
  ): Promise<void> {
    const userId = client.data.userId;

    try {
      await this.songGenerationService.cancelGeneration(
        data.generationId,
        userId
      );

      const roomName = `generation-${data.generationId}`;
      this.server.to(roomName).emit('generation-cancelled', {
        generationId: data.generationId,
        reason: 'user_cancelled',
        cancelledAt: new Date(),
      } as GenerationCancelledEvent);
    } catch (error) {
      client.emit('generation-error', {
        generationId: data.generationId,
        error: {
          code: 'CANCEL_FAILED',
          message: error.message,
          recoverable: false,
        },
        stage: 'unknown',
      } as GenerationErrorEvent);
    }
  }
}
```

### Progress Broadcasting Service

```typescript
// progress-broadcasting.service.ts
@Injectable()
export class ProgressBroadcastingService {
  constructor(
    private readonly webSocketServer: Server // Injected from gateway
  ) {}

  broadcastMetadataProgress(
    generationId: string,
    progress: number,
    status: string,
    currentStep: string
  ): void {
    const roomName = `generation-${generationId}`;
    const event: MetadataGenerationProgressEvent = {
      generationId,
      progress,
      status,
      currentStep: currentStep as any,
    };

    this.webSocketServer
      .to(roomName)
      .emit('metadata-generation-progress', event);
  }

  broadcastAudioProgress(
    generationId: string,
    progress: number,
    status: string,
    currentInstrument?: string,
    instrumentsCompleted?: number,
    totalInstruments?: number
  ): void {
    const roomName = `generation-${generationId}`;
    const event: AudioGenerationProgressEvent = {
      generationId,
      progress,
      status,
      currentInstrument,
      instrumentsCompleted: instrumentsCompleted || 0,
      totalInstruments: totalInstruments || 0,
    };

    this.webSocketServer.to(roomName).emit('audio-generation-progress', event);
  }

  broadcastGenerationComplete(
    generationId: string,
    songId: string,
    audioUrl: string,
    duration: number,
    fileSize: number,
    checksum: string
  ): void {
    const roomName = `generation-${generationId}`;
    const event: AudioGenerationCompleteEvent = {
      generationId,
      songId,
      audioUrl,
      duration,
      fileSize,
      checksum,
    };

    this.webSocketServer.to(roomName).emit('audio-generation-complete', event);
  }

  broadcastError(
    generationId: string,
    error: {
      code: string;
      message: string;
      details?: any;
      recoverable: boolean;
    },
    stage: 'metadata' | 'audio'
  ): void {
    const roomName = `generation-${generationId}`;
    const event: GenerationErrorEvent = {
      generationId,
      error,
      stage,
    };

    this.webSocketServer.to(roomName).emit('generation-error', event);
  }
}
```

## NGRX Integration

### Song Generation Actions

```typescript
// song-generation.actions.ts
export const metadataGenerationStarted = createAction(
  '[Song Generation] Metadata Generation Started',
  props<{ event: MetadataGenerationStartedEvent }>()
);

export const metadataGenerationProgress = createAction(
  '[Song Generation] Metadata Generation Progress',
  props<{ event: MetadataGenerationProgressEvent }>()
);

export const metadataGenerationComplete = createAction(
  '[Song Generation] Metadata Generation Complete',
  props<{ event: MetadataGenerationCompleteEvent }>()
);

export const audioGenerationStarted = createAction(
  '[Song Generation] Audio Generation Started',
  props<{ event: AudioGenerationStartedEvent }>()
);

export const audioGenerationProgress = createAction(
  '[Song Generation] Audio Generation Progress',
  props<{ event: AudioGenerationProgressEvent }>()
);

export const audioGenerationComplete = createAction(
  '[Song Generation] Audio Generation Complete',
  props<{ event: AudioGenerationCompleteEvent }>()
);

export const generationError = createAction(
  '[Song Generation] Generation Error',
  props<{ event: GenerationErrorEvent }>()
);

export const generationCancelled = createAction(
  '[Song Generation] Generation Cancelled',
  props<{ event: GenerationCancelledEvent }>()
);
```

### Song Generation Reducer

```typescript
// song-generation.reducer.ts
export interface SongGenerationState {
  activeGenerations: { [generationId: string]: GenerationProgress };
  completedGenerations: { [generationId: string]: GenerationResult };
  errors: { [generationId: string]: GenerationError };
}

const initialState: SongGenerationState = {
  activeGenerations: {},
  completedGenerations: {},
  errors: {},
};

export const songGenerationReducer = createReducer(
  initialState,

  on(metadataGenerationStarted, (state, { event }) => ({
    ...state,
    activeGenerations: {
      ...state.activeGenerations,
      [event.generationId]: {
        id: event.generationId,
        stage: 'metadata',
        progress: 0,
        status: 'Starting metadata generation...',
        startedAt: new Date(),
      },
    },
  })),

  on(metadataGenerationProgress, (state, { event }) => ({
    ...state,
    activeGenerations: {
      ...state.activeGenerations,
      [event.generationId]: {
        ...state.activeGenerations[event.generationId],
        progress: event.progress,
        status: event.status,
        currentStep: event.currentStep,
      },
    },
  })),

  on(metadataGenerationComplete, (state, { event }) => ({
    ...state,
    activeGenerations: {
      ...state.activeGenerations,
      [event.generationId]: {
        ...state.activeGenerations[event.generationId],
        stage: 'metadata-complete',
        progress: 100,
        status: 'Metadata generation complete',
        metadata: event.metadata,
      },
    },
  })),

  on(audioGenerationStarted, (state, { event }) => ({
    ...state,
    activeGenerations: {
      ...state.activeGenerations,
      [event.generationId]: {
        ...state.activeGenerations[event.generationId],
        stage: 'audio',
        progress: 0,
        status: 'Starting audio generation...',
        instruments: event.instruments,
      },
    },
  })),

  on(audioGenerationProgress, (state, { event }) => ({
    ...state,
    activeGenerations: {
      ...state.activeGenerations,
      [event.generationId]: {
        ...state.activeGenerations[event.generationId],
        progress: event.progress,
        status: event.status,
        currentInstrument: event.currentInstrument,
        instrumentsCompleted: event.instrumentsCompleted,
        totalInstruments: event.totalInstruments,
      },
    },
  })),

  on(audioGenerationComplete, (state, { event }) => {
    const { [event.generationId]: completed, ...remainingActive } =
      state.activeGenerations;
    return {
      ...state,
      activeGenerations: remainingActive,
      completedGenerations: {
        ...state.completedGenerations,
        [event.generationId]: {
          id: event.generationId,
          songId: event.songId,
          audioUrl: event.audioUrl,
          duration: event.duration,
          fileSize: event.fileSize,
          checksum: event.checksum,
          completedAt: new Date(),
        },
      },
    };
  }),

  on(generationError, (state, { event }) => ({
    ...state,
    errors: {
      ...state.errors,
      [event.generationId]: {
        id: event.generationId,
        error: event.error,
        stage: event.stage,
        occurredAt: new Date(),
      },
    },
  })),

  on(generationCancelled, (state, { event }) => {
    const { [event.generationId]: cancelled, ...remainingActive } =
      state.activeGenerations;
    return {
      ...state,
      activeGenerations: remainingActive,
      errors: {
        ...state.errors,
        [event.generationId]: {
          id: event.generationId,
          error: { code: 'CANCELLED', message: 'Generation cancelled by user' },
          stage: cancelled?.stage || 'unknown',
          occurredAt: new Date(),
        },
      },
    };
  })
);
```

## Error Handling and Recovery

### Automatic Reconnection

```typescript
// websocket.service.ts - Enhanced error handling
private setupConnectionEvents(): void {
  this.socket.on('connect', () => {
    this.connection$.next(true);
    // Rejoin all active generation rooms
    this.generationRooms.forEach(roomId => {
      this.socket.emit('join-generation', roomId);
    });
  });

  this.socket.on('disconnect', (reason) => {
    this.connection$.next(false);
    if (reason === 'io server disconnect') {
      // Server disconnected, manual reconnection needed
      this.attemptReconnection();
    }
  });

  this.socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    this.connection$.next(false);
    // Exponential backoff for reconnection
    setTimeout(() => this.attemptReconnection(), this.reconnectionDelay);
  });
}

private attemptReconnection(): void {
  if (this.socket && !this.socket.connected) {
    console.log('Attempting WebSocket reconnection...');
    this.socket.connect();
  }
}
```

### Error Recovery Strategies

```typescript
// progress-broadcasting.service.ts - Error recovery
async broadcastErrorWithRecovery(
  generationId: string,
  error: GenerationError,
  stage: 'metadata' | 'audio'
): Promise<void> {
  // Broadcast error to all clients in generation room
  this.broadcastError(generationId, error, stage);

  // Attempt recovery for recoverable errors
  if (error.recoverable) {
    switch (error.code) {
      case 'OLLAMA_TIMEOUT':
        // Restart Ollama service
        await this.restartOllamaService();
        break;
      case 'MUSICGEN_MEMORY':
        // Clear GPU memory and retry
        await this.clearGPUMemory();
        break;
      case 'NETWORK_TEMPORARY':
        // Wait and retry
        await this.delay(5000);
        break;
    }
  }
}
```

## Performance Optimization

### Connection Pooling

- **Room-based multiplexing**: Single WebSocket connection serves multiple generation rooms
- **Event batching**: Group rapid progress updates to reduce network overhead
- **Compression**: Enable Socket.IO compression for large event payloads

### Memory Management

- **Automatic cleanup**: Remove inactive generation rooms after timeout
- **Event throttling**: Limit progress update frequency to prevent UI flooding
- **Client-side caching**: Cache progress state to handle temporary disconnections

### Monitoring and Observability

```typescript
// websocket-monitoring.service.ts
@Injectable()
export class WebSocketMonitoringService {
  private metrics = {
    connections: 0,
    activeGenerations: 0,
    messagesSent: 0,
    errors: 0,
    averageLatency: 0,
  };

  trackConnection(clientId: string, userId: string): void {
    this.metrics.connections++;
    console.log(
      `WebSocket connection established: ${clientId} (User: ${userId})`
    );
  }

  trackGenerationStart(generationId: string): void {
    this.metrics.activeGenerations++;
  }

  trackGenerationComplete(generationId: string, duration: number): void {
    this.metrics.activeGenerations--;
    // Log performance metrics
  }

  trackError(error: GenerationError): void {
    this.metrics.errors++;
    // Alert monitoring system for critical errors
  }

  getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }
}
```

## Security Considerations

### Authentication and Authorization

- **JWT validation**: All WebSocket connections require valid JWT tokens
- **Room access control**: Users can only join rooms for their own generations
- **Rate limiting**: Prevent WebSocket spam and DoS attacks
- **Input validation**: Validate all incoming event data structures

### Data Privacy

- **No sensitive data**: Generation events contain only progress/status information
- **Ephemeral rooms**: Generation rooms are cleaned up after completion
- **Audit logging**: Log all WebSocket events for security monitoring
- **Encryption**: All WebSocket traffic uses WSS in production

## Testing Strategy

### Unit Tests

```typescript
// websocket.service.spec.ts
describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockSocket: jasmine.SpyObj<Socket>;

  beforeEach(() => {
    mockSocket = jasmine.createSpyObj('Socket', [
      'on',
      'emit',
      'disconnect',
      'connect',
    ]);
    TestBed.configureTestingModule({
      providers: [WebSocketService],
    });
    service = TestBed.inject(WebSocketService);
  });

  it('should join generation room', () => {
    service.joinGenerationRoom('gen-123');
    expect(mockSocket.emit).toHaveBeenCalledWith('join-generation', 'gen-123');
  });

  it('should handle metadata generation progress', (done) => {
    const progressEvent = {
      generationId: 'gen-123',
      progress: 50,
      status: 'Generating lyrics...',
      currentStep: 'lyrics',
    };

    service.getMetadataProgress('gen-123').subscribe((event) => {
      expect(event).toEqual(progressEvent);
      done();
    });

    // Simulate WebSocket event
    mockSocket.on.and.callFake((event, callback) => {
      if (event === 'metadata-generation-progress') {
        callback(progressEvent);
      }
    });
  });
});
```

### Integration Tests

```typescript
// song-generation.integration.spec.ts
describe('Song Generation WebSocket Integration', () => {
  let clientSocket: Socket;
  let server: Server;

  beforeEach((done) => {
    // Setup test server and client
    server = new Server();
    clientSocket = io('http://localhost:3333');

    clientSocket.on('connect', () => {
      done();
    });
  });

  it('should complete full song generation workflow', (done) => {
    const generationId = 'test-gen-123';

    // Join generation room
    clientSocket.emit('join-generation', generationId);

    // Listen for all generation events
    let eventsReceived = [];

    clientSocket.on('metadata-generation-started', (event) => {
      eventsReceived.push('metadata-started');
      expect(event.generationId).toBe(generationId);
    });

    clientSocket.on('metadata-generation-progress', (event) => {
      eventsReceived.push('metadata-progress');
      expect(event.progress).toBeGreaterThanOrEqual(0);
      expect(event.progress).toBeLessThanOrEqual(100);
    });

    clientSocket.on('metadata-generation-complete', (event) => {
      eventsReceived.push('metadata-complete');
      expect(event.metadata).toBeDefined();
    });

    clientSocket.on('audio-generation-started', (event) => {
      eventsReceived.push('audio-started');
    });

    clientSocket.on('audio-generation-progress', (event) => {
      eventsReceived.push('audio-progress');
    });

    clientSocket.on('audio-generation-complete', (event) => {
      eventsReceived.push('audio-complete');
      expect(event.audioUrl).toBeDefined();

      // Verify all expected events were received
      expect(eventsReceived).toContain('metadata-started');
      expect(eventsReceived).toContain('metadata-complete');
      expect(eventsReceived).toContain('audio-started');
      expect(eventsReceived).toContain('audio-complete');

      done();
    });

    // Start generation (this would trigger the server-side flow)
    // server.emitToRoom(generationId, 'start-generation', testData);
  });
});
```

## Deployment Considerations

### Production Configuration

```typescript
// websocket.config.ts
export const websocketConfig = {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Fallback for corporate firewalls
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e8, // 100MB for large audio metadata
  connectTimeout: 20000, // 20 seconds
};
```

### Load Balancing

- **Sticky sessions**: Ensure WebSocket connections stay on same server instance
- **Redis adapter**: For multi-server WebSocket broadcasting
- **Health checks**: Monitor WebSocket connection health and latency
- **Auto-scaling**: Scale WebSocket servers based on active connections

### Monitoring and Alerting

- **Connection metrics**: Track active connections, rooms, and message rates
- **Performance monitoring**: WebSocket latency and throughput
- **Error tracking**: Failed connections, disconnections, and generation errors
- **Business metrics**: Generation success rates, user engagement with real-time features

---

## Summary

The WebSocket integration provides real-time, bidirectional communication for Harmonia's sophisticated song generation pipeline. Key features include:

- **Multi-stage progress tracking**: Detailed progress updates for both metadata and audio generation phases
- **Room-based subscriptions**: Efficient event routing for multiple concurrent generations
- **Error handling and recovery**: Robust error propagation with recovery strategies
- **NGRX integration**: Seamless state management for complex generation workflows
- **Performance optimization**: Connection pooling, event batching, and memory management
- **Security**: JWT authentication, rate limiting, and input validation
- **Testing**: Comprehensive unit and integration tests for reliability
- **Monitoring**: Production-ready observability and alerting

This WebSocket system enables the rich, interactive user experience required for AI-powered music generation while maintaining the performance and reliability needed for production deployment.

```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: Socket | null = null;
  private destroy$ = new Subject&lt;void&gt;();

  constructor(private store: Store&lt;AppState&gt;) {}

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
  private getJobStatusUpdates(): Observable&lt;JobStatusEvent&gt; {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent&lt;JobStatusEvent&gt;(this.socket, 'job:status');
  }

  private getJobProgressUpdates(): Observable&lt;JobProgressEvent&gt; {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent&lt;JobProgressEvent&gt;(this.socket, 'job:progress');
  }

  private getJobCompletedEvents(): Observable&lt;JobCompletedEvent&gt; {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent&lt;JobCompletedEvent&gt;(this.socket, 'job:completed');
  }

  private getJobFailedEvents(): Observable&lt;JobFailedEvent&gt; {
    if (!this.socket) throw new Error('Socket not connected');
    return fromEvent&lt;JobFailedEvent&gt;(this.socket, 'job:failed');
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

## Backend Implementation Details

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

    this.server
      .to(jobRoom)
      .to(userRoom)
      .emit('job:failed', { id: jobId, error });
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

| Event                   | Payload             | Description                  |
| ----------------------- | ------------------- | ---------------------------- |
| `job:subscribe`         | `{ jobId: string }` | Subscribe to specific job    |
| `job:unsubscribe`       | `{ jobId: string }` | Unsubscribe from job         |
| `jobs:subscribe:user`   | (none)              | Subscribe to all user's jobs |
| `jobs:unsubscribe:user` | (none)              | Unsubscribe from user's jobs |

### Server → Client (Broadcasts)

| Event           | Payload                                 | Description                |
| --------------- | --------------------------------------- | -------------------------- |
| `job:status`    | `{ id: string, status: JobStatus }`     | Job status changed         |
| `job:progress`  | `{ id: string, progress: JobProgress }` | Job progress updated       |
| `job:completed` | `{ job: Job }`                          | Job completed successfully |
| `job:failed`    | `{ id: string, error: string }`         | Job failed with error      |
| `connect`       | (built-in)                              | Socket connected           |
| `disconnect`    | (built-in)                              | Socket disconnected        |
| `connect_error` | (built-in)                              | Connection error           |

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
this.server
  .to(`job:${jobId}`)
  .emit('job:status', { id: jobId, status: 'processing' });

// Broadcast to user's jobs
this.server
  .to(`user:${userId}:jobs`)
  .emit('job:status', { id: jobId, status: 'completed' });

// Broadcast to multiple rooms
this.server
  .to(`job:${jobId}`)
  .to(`user:${userId}:jobs`)
  .emit('job:completed', { job });
```

## NGRX State Management Integration

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
    jobsAdapter.updateOne({ id, changes: { status } }, state)
  ),

  // Real-time progress update
  on(JobsActions.jobProgressUpdated, (state, { id, progress }) =>
    jobsAdapter.updateOne({ id, changes: { progress } }, state)
  ),

  // Job completed (full update)
  on(JobsActions.jobCompleted, (state, { job }) =>
    jobsAdapter.updateOne({ id: job.id, changes: job }, state)
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
    <mat-progress-bar mode="determinate" [value]="job.progress.percentage">
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

## Performance Optimization Strategies

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
