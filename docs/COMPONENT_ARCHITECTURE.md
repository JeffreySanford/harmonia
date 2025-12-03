# Component Architecture Guide

## Overview

Harmonia follows a **strict NgModule-based architecture** with separated HTML/SCSS files for all components. This guide covers component patterns, styling architecture, and best practices for Phase 1.

## Component Principles

### 1. No Standalone Components

❌ **Prohibited**: Standalone components

```typescript
@Component({
  selector: 'app-example',
  standalone: true, // NEVER USE THIS
  templateUrl: './example.component.html',
})
export class ExampleComponent {}
```

✅ **Required**: NgModule-based components

```typescript
@Component({
  selector: 'app-example',
  standalone: false, // Always explicitly set to false
  templateUrl: './example.component.html',
  styleUrl: './example.component.scss',
})
export class ExampleComponent {}
```

**ESLint Enforcement**: Custom rule `.eslint/rules/no-standalone-components.mjs` prevents `standalone: true`.

### 2. Separated Files (No Inline Styles/Templates)

✅ **Every component must have**:

- `.ts` - Component logic
- `.html` - Template (no inline templates)
- `.scss` - Styles (no inline styles)

```text
src/app/components/example/
├── example.component.ts
├── example.component.html
├── example.component.scss
└── example.component.spec.ts
```

❌ **Never use inline**:

```typescript
@Component({
  selector: 'app-example',
  template: '<div>Bad</div>', // NO
  styles: ['div { color: red; }'], // NO
})
```

### 3. SCSS @use Pattern

**Always import from styles folder**:

```scss
// example.component.scss
@use '../../../styles/colors';
@use '../../../styles/mixins';
@use '../../../styles/typography';

.example-container {
  background-color: colors.$primary-500;
  @include mixins.flex-center;
  @include typography.body-1;
}
```

**Never duplicate styles** - use the shared SCSS modules:

- `styles/_colors.scss` - Color palette, semantic colors
- `styles/_mixins.scss` - Reusable patterns (flex, elevation, hover)
- `styles/_typography.scss` - Font scales, text styles
- `styles/_layout.scss` - Spacing utilities, grid
- `styles/_animations.scss` - Keyframes, transitions

## Application Layout Structure

### Flexbox-First Approach

Harmonia uses **Flexbox** as the primary layout mechanism:

```scss
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
```

### Layout Hierarchy

```text
app-container (flex column)
├── app-header (64px height, full width)
├── app-content (flex row, fills remaining space)
│   ├── app-sidebar (240px width)
│   └── main-stage (flex: 1)
└── app-footer (48px height, full width)
```

### App Component (`apps/frontend/src/app/app.ts`)

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'harmonia-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'frontend';
}
```

### Layout Template (`app.html`)

```html
<div class="app-container">
  <header class="app-header">
    <h1 class="app-title">Harmonia</h1>
    <nav class="app-nav">
      <!-- User menu, notifications -->
    </nav>
  </header>

  <div class="app-content">
    <aside class="app-sidebar">
      <nav class="sidebar-nav">
        <a routerLink="/generate/song" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">🎵</span>
          <span class="nav-label">Song Generation</span>
        </a>
        <!-- More nav items -->
      </nav>
    </aside>

    <main class="main-stage">
      <router-outlet></router-outlet>
    </main>
  </div>

  <footer class="app-footer">
    <p class="footer-text">© 2025 Harmonia - Phase 1</p>
  </footer>
</div>
```

### Layout Styles (`app.scss`)

```scss
@use '../styles/colors';
@use '../styles/mixins';
@use '../styles/typography';

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: colors.$background;
}

.app-header {
  @include mixins.flex-between;
  width: 100%;
  height: 64px;
  padding: 0 mixins.spacing(3);
  background: linear-gradient(135deg, colors.$primary-500, colors.$primary-700);
  color: colors.$white;
  box-shadow: colors.$elevation-4;
}

.app-sidebar {
  width: 240px;
  background-color: colors.$surface;
  border-right: 1px solid colors.$border;
  padding: mixins.spacing(1);
  overflow-y: auto;
}

.main-stage {
  flex: 1;
  overflow-y: auto;
  background-color: colors.$background;
  padding: mixins.spacing(3);
}

.app-footer {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: colors.$surface;
  border-top: 1px solid colors.$border;
}
```

## Navigation Structure

### Four Main Routes

1. **Song Generation** (`/generate/song`)
   - Narrative-driven song creation
   - Style and title selection
   - Lyric generation

2. **Music Generation** (`/generate/music`)
   - Instrumental music creation
   - Genre and mood selection
   - MusicGen integration

3. **Video Generation** (`/generate/video`)
   - Text-to-video generation
   - Scene composition
   - Style transfer

4. **Video Editing** (`/edit/video`)
   - Storyboard editor
   - Scene arrangement
   - Timeline editing

### Sidebar Component Pattern

```typescript
// sidebar.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  navItems = [
    { icon: '🎵', label: 'Song Generation', route: '/generate/song' },
    { icon: '🎼', label: 'Music Generation', route: '/generate/music' },
    { icon: '🎬', label: 'Video Generation', route: '/generate/video' },
    { icon: '✂️', label: 'Video Editing', route: '/edit/video' },
  ];
}
```

```html
<!-- sidebar.component.html -->
<nav class="sidebar-nav">
  <a
    *ngFor="let item of navItems"
    [routerLink]="item.route"
    routerLinkActive="active"
    class="nav-item"
  >
    <span class="nav-icon">{{ item.icon }}</span>
    <span class="nav-label">{{ item.label }}</span>
  </a>
</nav>
```

```scss
// sidebar.component.scss
@use '../../../styles/colors';
@use '../../../styles/mixins';
@use '../../../styles/typography';

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: mixins.spacing(0.5);
}

.nav-item {
  @include mixins.flex-align-center;
  gap: mixins.spacing(1.5);
  padding: mixins.spacing(1.5) mixins.spacing(2);
  border-radius: 8px;
  color: colors.$text-primary;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background-color: colors.$primary-50;
    color: colors.$primary-700;
  }

  &.active {
    background-color: colors.$primary-100;
    color: colors.$primary-700;
    font-weight: 600;
    box-shadow: colors.$elevation-1;
  }

  .nav-icon {
    font-size: 24px;
    width: 32px;
    text-align: center;
  }

  .nav-label {
    @include typography.body-1;
    flex: 1;
  }
}
```

## Component Patterns

### Feature Component Structure

```text
src/app/features/song-generation/
├── song-generation.module.ts        # Feature module
├── song-generation-routing.module.ts # Routing
├── components/
│   ├── song-form/
│   │   ├── song-form.component.ts
│   │   ├── song-form.component.html
│   │   ├── song-form.component.scss
│   │   └── song-form.component.spec.ts
│   ├── style-selector/
│   │   ├── style-selector.component.ts
│   │   ├── style-selector.component.html
│   │   ├── style-selector.component.scss
│   │   └── style-selector.component.spec.ts
│   └── lyric-editor/
│       ├── lyric-editor.component.ts
│       ├── lyric-editor.component.html
│       ├── lyric-editor.component.scss
│       └── lyric-editor.component.spec.ts
└── pages/
    ├── song-generation-page/
    │   ├── song-generation-page.component.ts
    │   ├── song-generation-page.component.html
    │   ├── song-generation-page.component.scss
    │   └── song-generation-page.component.spec.ts
```

### Smart vs. Presentational Components

**Smart Components** (Container/Page):

- Connect to NGRX store
- Handle business logic
- Dispatch actions
- Pass data to presentational components

```typescript
// song-generation-page.component.ts
import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from '../../../../store/app.state';
import * as JobsActions from '../../../../store/jobs/jobs.actions';
import * as fromJobs from '../../../../store/jobs/jobs.selectors';

@Component({
  selector: 'app-song-generation-page',
  standalone: false,
  templateUrl: './song-generation-page.component.html',
  styleUrl: './song-generation-page.component.scss',
})
export class SongGenerationPageComponent implements OnInit {
  jobs$!: Observable<Job[]>;
  loading$!: Observable<boolean>;

  constructor(private store: Store<AppState>) {}

  ngOnInit(): void {
    this.jobs$ = this.store.select(fromJobs.selectAllJobs);
    this.loading$ = this.store.select(fromJobs.selectJobsLoading);
    this.store.dispatch(JobsActions.loadJobs());
  }

  onSubmit(params: SongParams): void {
    this.store.dispatch(
      JobsActions.createJob({
        jobType: 'generate',
        parameters: params,
      })
    );
  }
}
```

**Presentational Components** (Dumb):

- Receive data via `@Input()`
- Emit events via `@Output()`
- No NGRX dependencies
- Pure presentation logic

```typescript
// song-form.component.ts
import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-song-form',
  standalone: false,
  templateUrl: './song-form.component.html',
  styleUrl: './song-form.component.scss',
})
export class SongFormComponent {
  @Output() submit = new EventEmitter<SongParams>();

  onSubmit(form: NgForm): void {
    if (form.valid) {
      this.submit.emit(form.value);
    }
  }
}
```

### Material Component Usage

**Harmonia uses dedicated Material Design modules per feature** for tree-shaking and centralized imports.

See [MATERIAL_MODULES.md](./MATERIAL_MODULES.md) for complete documentation.

```typescript
// Import dedicated Material module (preferred approach)
import { SongGenerationMaterialModule } from './song-generation-material.module';

@NgModule({
  declarations: [
    SongGenerationPageComponent,
    SongFormComponent,
    StyleSelectorComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SongGenerationMaterialModule,  // Single import for all Material components
  ],
})
export class SongGenerationModule {}
```

**Material Module Structure** (`song-generation-material.module.ts`):

```typescript
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@NgModule({
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  exports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ]
})
export class SongGenerationMaterialModule {}
```

**Benefits**:

- 67% bundle size reduction through tree-shaking
- Centralized Material imports per feature
- Only loads Material components needed by each route
- Easier to audit and maintain

```text
(See MATERIAL_MODULES.md for complete implementation details)
```

### Component Template with Material

```html
<!-- song-form.component.html -->
<mat-card class="song-form-card">
  <mat-card-header>
    <mat-card-title>Generate Song</mat-card-title>
  </mat-card-header>

  <mat-card-content>
    <form [formGroup]="songForm" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Song Title</mat-label>
        <input matInput formControlName="title" placeholder="Enter title" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Genre</mat-label>
        <mat-select formControlName="genre">
          <mat-option value="rock">Rock</mat-option>
          <mat-option value="pop">Pop</mat-option>
          <mat-option value="jazz">Jazz</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-raised-button color="primary" type="submit">
        Generate
      </button>
    </form>
  </mat-card-content>
</mat-card>
```

### Component SCSS with @use

```scss
// song-form.component.scss
@use '../../../../styles/colors';
@use '../../../../styles/mixins';
@use '../../../../styles/typography';

.song-form-card {
  @include mixins.card-elevated;
  max-width: 600px;
  margin: 0 auto;

  .full-width {
    width: 100%;
    margin-bottom: mixins.spacing(2);
  }

  button[type='submit'] {
    width: 100%;
    height: 48px;
    @include typography.button;
  }
}
```

## Routing Patterns

### Feature Module Routing

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

### Lazy Loading in App Routes

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
  {
    path: 'generate/music',
    loadChildren: () =>
      import('./features/music-generation/music-generation.module').then(
        (m) => m.MusicGenerationModule
      ),
  },
  {
    path: 'generate/video',
    loadChildren: () =>
      import('./features/video-generation/video-generation.module').then(
        (m) => m.VideoGenerationModule
      ),
  },
  {
    path: 'edit/video',
    loadChildren: () =>
      import('./features/video-editing/video-editing.module').then(
        (m) => m.VideoEditingModule
      ),
  },
  {
    path: '',
    redirectTo: '/generate/song',
    pathMatch: 'full',
  },
];
```

## Best Practices

### 1. SCSS Organization

✅ **Prefer styles folder over component styles**:

```scss
// Good - minimal component styles
@use '../../../styles/colors';
@use '../../../styles/mixins';

.song-form {
  @include mixins.card-elevated; // From mixins
  background-color: colors.$surface; // From colors
}
```

❌ **Avoid duplicating patterns**:

```scss
// Bad - duplicating existing mixins
.song-form {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 16px;
}
```

### 2. Component Naming

- **PascalCase** for component classes: `SongFormComponent`
- **kebab-case** for selectors: `app-song-form`
- **kebab-case** for files: `song-form.component.ts`

### 3. Module Structure

```typescript
@NgModule({
  declarations: [
    /* Components declared in this module */
  ],
  imports: [
    /* Angular/Material modules needed */
  ],
  exports: [
    /* Components exported for use in other modules */
  ],
  providers: [
    /* Services scoped to this module */
  ],
})
export class FeatureModule {}
```

### 4. Avoid Deep Nesting

❌ **Bad**: Deep component nesting

```html
<div>
  <div>
    <div>
      <div>
        <button>Click</button>
      </div>
    </div>
  </div>
</div>
```

✅ **Good**: Flat structure with Flexbox

```html
<div class="container">
  <button class="action-button">Click</button>
</div>
```

```scss
.container {
  @include mixins.flex-center;
  padding: mixins.spacing(2);
}
```

### 5. Responsive Design

Use mixins for breakpoints:

```scss
@use '../../../styles/mixins';

.sidebar {
  width: 240px;

  @include mixins.mobile {
    width: 200px;
  }

  @include mixins.tablet {
    width: 220px;
  }
}
```

## Testing Patterns

### Component Testing

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SongFormComponent } from './song-form.component';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('SongFormComponent', () => {
  let component: SongFormComponent;
  let fixture: ComponentFixture<SongFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SongFormComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SongFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit submit event with form data', () => {
    spyOn(component.submit, 'emit');
    component.songForm.patchValue({ title: 'Test Song', genre: 'rock' });
    component.onSubmit();
    expect(component.submit.emit).toHaveBeenCalledWith({
      title: 'Test Song',
      genre: 'rock',
    });
  });
});
```

## Resources

- [Angular Style Guide](https://angular.io/guide/styleguide)
- [Angular Material Components](https://material.angular.io/components)
- [SCSS @use Rule](https://sass-lang.com/documentation/at-rules/use)
- [Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
