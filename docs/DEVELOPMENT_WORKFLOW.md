# Development Workflow Guide

## Quick Start

### Prerequisites

- **Node.js 20+** (LTS)
- **pnpm 10.23.0+**
- **MongoDB 8.0.6** (running locally or via Docker)
- **Git** for version control

### Initial Setup

```bash
# Clone repository
git clone https://github.com/jeffreysanford/harmonia.git
cd harmonia

# Install dependencies
pnpm install

# Start development servers (frontend + backend)
pnpm dev
```

### Available Scripts

#### Development

```bash
# Start both frontend and backend (parallel)
pnpm dev

# Start frontend only (http://localhost:4200)
pnpm dev:frontend

# Start backend only (http://localhost:3333)
pnpm dev:backend
```

#### Building

```bash
# Build all applications
pnpm build:all

# Build frontend only
pnpm build:frontend

# Build backend only
pnpm build:backend
```

#### Testing

```bash
# Run all tests
pnpm test

# Run frontend tests
pnpm test:frontend

# Run backend tests
pnpm test:backend

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

#### Linting

```bash
# Lint all projects
pnpm lint

# Lint frontend only
pnpm lint:frontend

# Lint backend only
pnpm lint:backend

# Auto-fix linting errors
pnpm lint:fix
```

#### End-to-End Testing

```bash
# Run frontend E2E tests (Playwright)
pnpm e2e:frontend

# Run backend E2E tests (Jest)
pnpm e2e:backend
```

## Project Structure

```text
harmonia/
├── apps/
│   ├── frontend/              # Angular 21 application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── features/  # Feature modules (lazy loaded)
│   │   │   │   ├── services/  # HTTP services
│   │   │   │   ├── store/     # NGRX state management
│   │   │   │   ├── app.ts     # Root component
│   │   │   │   ├── app.html   # Root template
│   │   │   │   ├── app.scss   # Root styles
│   │   │   │   └── app-module.ts
│   │   │   ├── styles/        # Shared SCSS modules
│   │   │   │   ├── _colors.scss
│   │   │   │   ├── _mixins.scss
│   │   │   │   ├── _typography.scss
│   │   │   │   ├── _layout.scss
│   │   │   │   └── _animations.scss
│   │   │   ├── index.html
│   │   │   └── main.ts
│   │   ├── project.json       # Nx project config
│   │   └── tsconfig.json
│   ├── frontend-e2e/          # Playwright E2E tests
│   ├── backend/               # NestJS 11 application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── controllers/
│   │   │   │   ├── services/
│   │   │   │   ├── gateways/  # WebSocket gateways
│   │   │   │   ├── app.module.ts
│   │   │   │   └── app.service.ts
│   │   │   └── main.ts
│   │   ├── project.json
│   │   └── tsconfig.json
│   └── backend-e2e/           # Jest E2E tests
├── docs/                      # Documentation (30+ files)
├── scripts/                   # Build/deployment scripts
├── .eslint/                   # Custom ESLint rules
│   └── rules/
│       └── no-standalone-components.mjs
├── nx.json                    # Nx workspace config
├── package.json               # Root dependencies + scripts
├── pnpm-workspace.yaml        # pnpm workspace definition
└── tsconfig.json              # Base TypeScript config
```

## Development Guidelines

### Creating New Components

#### 1. Generate Component with Nx

```bash
# Generate component in feature module
nx generate @nx/angular:component \
  components/my-component \
  --project=frontend \
  --path=apps/frontend/src/app/features/song-generation
```

#### 2. Set standalone: false

```typescript
// my-component.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-my-component',
  standalone: false, // REQUIRED
  templateUrl: './my-component.component.html',
  styleUrl: './my-component.component.scss',
})
export class MyComponent {}
```

#### 3. Add SCSS Imports

```scss
// my-component.component.scss
@use '../../../../styles/colors';
@use '../../../../styles/mixins';
@use '../../../../styles/typography';

.my-component {
  @include mixins.card-elevated;
  background-color: colors.$surface;
  padding: mixins.spacing(2);

  .title {
    @include typography.heading-6;
    color: colors.$primary-700;
  }
}
```

#### 4. Register in Module

```typescript
// song-generation.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MyComponent } from './components/my-component/my-component.component';

@NgModule({
  declarations: [MyComponent],
  imports: [CommonModule],
  exports: [MyComponent],
})
export class SongGenerationModule {}
```

### Creating Feature Modules

#### 1. Generate Module

```bash
# Create feature module with routing
nx generate @nx/angular:module \
  features/song-generation \
  --project=frontend \
  --routing
```

#### 2. Create Module Structure

```text
features/song-generation/
├── song-generation.module.ts
├── song-generation-routing.module.ts
├── components/               # Presentational components
│   ├── song-form/
│   ├── style-selector/
│   └── lyric-editor/
└── pages/                    # Smart/Container components
    └── song-generation-page/
```

#### 3. Implement Module

```typescript
// song-generation.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { SongGenerationRoutingModule } from './song-generation-routing.module';
import { SongGenerationPageComponent } from './pages/song-generation-page/song-generation-page.component';
import { SongFormComponent } from './components/song-form/song-form.component';

@NgModule({
  declarations: [SongGenerationPageComponent, SongFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SongGenerationRoutingModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class SongGenerationModule {}
```

#### 4. Configure Routing

```typescript
// song-generation-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SongGenerationPageComponent } from './pages/song-generation-page/song-generation-page.component';

const routes: Routes = [
  {
    path: '',
    component: SongGenerationPageComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SongGenerationRoutingModule {}
```

#### 5. Add Lazy Route in App Routes

```typescript
// app.routes.ts
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'generate/song',
    loadChildren: () =>
      import('./features/song-generation/song-generation.module').then(
        (m) => m.SongGenerationModule
      ),
  },
  // ... other routes
];
```

### NGRX State Management

#### 1. Dispatch Actions from Components

```typescript
// song-generation-page.component.ts
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../store/app.state';
import * as JobsActions from '../../../../store/jobs/jobs.actions';

@Component({
  selector: 'app-song-generation-page',
  standalone: false,
  templateUrl: './song-generation-page.component.html',
  styleUrl: './song-generation-page.component.scss',
})
export class SongGenerationPageComponent {
  constructor(private store: Store<AppState>) {}

  onGenerate(params: SongParams): void {
    this.store.dispatch(
      JobsActions.createJob({
        jobType: 'generate',
        parameters: params,
      })
    );
  }
}
```

#### 2. Select Data from Store

```typescript
import { Observable } from 'rxjs';
import * as fromJobs from '../../../../store/jobs/jobs.selectors';

export class SongGenerationPageComponent implements OnInit {
  jobs$!: Observable<Job[]>;
  loading$!: Observable<boolean>;

  constructor(private store: Store<AppState>) {}

  ngOnInit(): void {
    this.jobs$ = this.store.select(fromJobs.selectAllJobs);
    this.loading$ = this.store.select(fromJobs.selectJobsLoading);
  }
}
```

#### 3. Use in Template

```html
<div class="jobs-list">
  <div *ngIf="loading$ | async" class="loading">
    <mat-spinner></mat-spinner>
  </div>

  <div *ngFor="let job of jobs$ | async" class="job-card">
    <h3>{{ job.jobType }}</h3>
    <p>Status: {{ job.status }}</p>
  </div>
</div>
```

### WebSocket Integration

#### 1. Connect on Authentication

```typescript
// app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs/operators';
import { WebSocketService } from './services/websocket.service';
import * as fromAuth from './store/auth/auth.selectors';

export class App implements OnInit, OnDestroy {
  constructor(
    private store: Store<AppState>,
    private websocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.store
      .select(fromAuth.selectAuthToken)
      .pipe(filter((token) => !!token))
      .subscribe((token) => {
        this.websocketService.connect(token!);
        this.websocketService.subscribeToUserJobs();
      });
  }

  ngOnDestroy(): void {
    this.websocketService.disconnect();
  }
}
```

#### 2. Subscribe to Specific Jobs

```typescript
// job-detail.component.ts
export class JobDetailComponent implements OnInit, OnDestroy {
  jobId!: string;

  constructor(
    private route: ActivatedRoute,
    private websocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.jobId = this.route.snapshot.params['id'];
    this.websocketService.subscribeToJob(this.jobId);
  }

  ngOnDestroy(): void {
    this.websocketService.unsubscribeFromJob(this.jobId);
  }
}
```

### Styling with SCSS

#### 1. Import Shared Styles

```scss
// Always import from styles folder
@use '../../../styles/colors';
@use '../../../styles/mixins';
@use '../../../styles/typography';
@use '../../../styles/layout';
```

#### 2. Use Mixins for Common Patterns

```scss
.card {
  @include mixins.card-elevated;
  @include mixins.flex-column;
  gap: mixins.spacing(2);
}

.title {
  @include typography.heading-5;
  color: colors.$primary-700;
}

.button {
  @include mixins.button-primary;
  @include mixins.hover-lift;
}
```

#### 3. Use Semantic Colors

```scss
.success-message {
  background-color: colors.$success-light;
  color: colors.$success-dark;
  border-left: 4px solid colors.$success;
}

.error-message {
  background-color: colors.$error-light;
  color: colors.$error-dark;
  border-left: 4px solid colors.$error;
}
```

## Backend Development

### Creating Controllers

```typescript
// songs.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';

@Controller('api/songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get()
  async findAll() {
    return this.songsService.findAll();
  }

  @Post()
  async create(@Body() createSongDto: CreateSongDto) {
    return this.songsService.create(createSongDto);
  }
}
```

### Creating Services

```typescript
// songs.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Song, SongDocument } from './schemas/song.schema';

@Injectable()
export class SongsService {
  constructor(@InjectModel(Song.name) private songModel: Model<SongDocument>) {}

  async findAll(): Promise<Song[]> {
    return this.songModel.find().exec();
  }

  async create(song: CreateSongDto): Promise<Song> {
    const createdSong = new this.songModel(song);
    return createdSong.save();
  }
}
```

### WebSocket Gateways

```typescript
// songs.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class SongsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('song:generate')
  handleGenerate(@MessageBody() data: { params: SongParams }) {
    // Process song generation
    this.server.emit('song:progress', { progress: 50 });
  }

  broadcastCompletion(songId: string): void {
    this.server.emit('song:completed', { songId });
  }
}
```

## Unit Testing

### Component Testing

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { SongFormComponent } from './song-form.component';

describe('SongFormComponent', () => {
  let component: SongFormComponent;
  let fixture: ComponentFixture<SongFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SongFormComponent],
      providers: [provideMockStore()],
    }).compileComponents();

    fixture = TestBed.createComponent(SongFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit form data on submit', () => {
    spyOn(component.submit, 'emit');
    component.form.patchValue({ title: 'Test Song' });
    component.onSubmit();
    expect(component.submit.emit).toHaveBeenCalled();
  });
});
```

### Service Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SongsService } from './songs.service';

describe('SongsService', () => {
  let service: SongsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SongsService],
    });
    service = TestBed.inject(SongsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

## Debugging

### Frontend Debugging

#### Chrome DevTools

1. Open Chrome DevTools (F12)
2. **Sources** tab → Set breakpoints in TypeScript files
3. **Console** tab → View logs and errors
4. **Network** tab → Monitor HTTP requests
5. **Redux DevTools** → Inspect NGRX state changes

#### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}/apps/frontend/src"
    }
  ]
}
```

### Backend Debug Configuration

#### Backend Launch Config

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["dev:backend"],
  "console": "integratedTerminal"
}
```

## Common Issues

### Issue: Port Already in Use

```bash
# Kill process on port 4200 (frontend)
npx kill-port 4200

# Kill process on port 3333 (backend)
npx kill-port 3333
```

### Issue: Node Modules Out of Sync

```bash
# Remove node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: Nx Cache Issues

```bash
# Clear Nx cache
nx reset

# Rebuild
pnpm build:all
```

### Issue: ESLint Errors

```bash
# Auto-fix linting errors
pnpm lint:fix

# Check specific project
pnpm lint:frontend
```

## Resources

- [Nx Documentation](https://nx.dev)
- [Angular Documentation](https://angular.io)
- [NestJS Documentation](https://docs.nestjs.com)
- [NGRX Documentation](https://ngrx.io)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Angular Material](https://material.angular.io)
