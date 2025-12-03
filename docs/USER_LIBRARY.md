# User Library System

## Overview

The User Library is a personalized view where authenticated users can browse, play, download, and manage their generated content. It serves as a central hub for all music generation output, including songs, audio files, and saved style presets.

**Key Features**:

- Grid/list view of user's generated content
- Audio playback with HTML5 player controls
- Download functionality for wav/mp3 files
- Delete functionality with confirmation
- Filter by content type (songs, styles, audio)
- Search by title, genre, or metadata
- Pagination or infinite scroll for large collections
- Integration with NGRX for state management
- Route guard protection (requires authentication)

## Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                         Frontend (Angular)                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐           ┌──────────────────┐             │
│  │   Library Page   │           │  Audio Player    │             │
│  │   Component      │──────────>│   Component      │             │
│  │  (Grid/List)     │           │  (Play/Pause)    │             │
│  └────────┬─────────┘           └──────────────────┘             │
│           │                                                        │
│           │                                                        │
│  ┌────────▼─────────────────────────────────────┐                │
│  │        NGRX Library State                    │                │
│  │  - items: LibraryItem[]                      │                │
│  │  - selectedItem: LibraryItem | null          │                │
│  │  - filters: { type, search }                 │                │
│  │  - loading, error                            │                │
│  └────────┬─────────────────────────────────────┘                │
│           │                                                        │
│  ┌────────▼─────────────────────────────────────┐                │
│  │        Library Effects                       │                │
│  │  - loadLibrary$ (fetch from API)             │                │
│  │  - deleteItem$ (delete + refresh)            │                │
│  │  - downloadItem$ (trigger download)          │                │
│  └────────┬─────────────────────────────────────┘                │
│           │                                                        │
└───────────┼────────────────────────────────────────────────────────┘
            │
            │ HTTP Requests (with JWT auth)
            │
┌───────────▼────────────────────────────────────────────────────────┐
│                         Backend (NestJS)                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────┐            │
│  │         Library Controller                       │            │
│  │  GET  /api/library                               │            │
│  │  GET  /api/library/:id                           │            │
│  │  DELETE /api/library/:id                         │            │
│  │  GET  /api/library/:id/download                  │            │
│  └──────────────┬───────────────────────────────────┘            │
│                 │                                                  │
│  ┌──────────────▼───────────────────────────────────┐            │
│  │         Library Service                          │            │
│  │  - findByUserId(userId)                          │            │
│  │  - findById(id, userId)                          │            │
│  │  - delete(id, userId)                            │            │
│  │  - getFileUrl(id)                                │            │
│  └──────────────┬───────────────────────────────────┘            │
│                 │                                                  │
│         ┌───────┴────────┐                                        │
│         │                │                                        │
│  ┌──────▼──────┐  ┌─────▼───────┐                                │
│  │   MongoDB   │  │  File       │                                │
│  │  Library    │  │  Storage    │                                │
│  │  Collection │  │  (S3/Local) │                                │
│  └─────────────┘  └─────────────┘                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## MongoDB Library Schema

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LibraryItemDocument = LibraryItem & Document;

@Schema({ timestamps: true })
export class LibraryItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Song', index: true })
  songId?: Types.ObjectId;  // Optional: Link to original song metadata

  @Prop({ required: true, enum: ['song', 'music', 'audio', 'style'] })
  type: 'song' | 'music' | 'audio' | 'style';

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  fileUrl: string;  // S3 URL or local file path

  @Prop({ enum: ['wav', 'mp3', 'flac', 'json'] })
  fileType: string;

  @Prop()
  fileSize?: number;  // In bytes

  @Prop()
  duration?: number;  // Audio duration in seconds

  @Prop()
  thumbnailUrl?: string;  // Waveform image or album art

  @Prop({ type: Object })
  metadata: {
    genre?: string;
    mood?: string;
    bpm?: number;
    key?: string;
    instruments?: string[];
    model?: string;  // AI model used
    generationTime?: number;  // Time to generate (seconds)
  };

  @Prop({ default: false })
  isPublic: boolean;  // Future: Share with others

  @Prop({ default: 0 })
  playCount: number;

  @Prop({ default: 0 })
  downloadCount: number;

  // Timestamps added by @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const LibraryItemSchema = SchemaFactory.createForClass(LibraryItem);

// Compound index for efficient queries
LibraryItemSchema.index({ userId: 1, createdAt: -1 });
LibraryItemSchema.index({ userId: 1, type: 1 });
LibraryItemSchema.index({ userId: 1, title: 'text' });  // Text search
```

## Frontend Implementation

### Library State (NGRX)

```typescript
// library.state.ts
export interface LibraryState {
  items: LibraryItem[];
  selectedItem: LibraryItem | null;
  loading: boolean;
  error: string | null;
  filters: {
    type: 'all' | 'song' | 'music' | 'audio' | 'style';
    search: string;
    sortBy: 'newest' | 'oldest' | 'title' | 'mostPlayed';
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface LibraryItem {
  id: string;
  userId: string;
  songId?: string;
  type: 'song' | 'music' | 'audio' | 'style';
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  metadata: {
    genre?: string;
    mood?: string;
    bpm?: number;
    key?: string;
    instruments?: string[];
    model?: string;
    generationTime?: number;
  };
  isPublic: boolean;
  playCount: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const initialLibraryState: LibraryState = {
  items: [],
  selectedItem: null,
  loading: false,
  error: null,
  filters: {
    type: 'all',
    search: '',
    sortBy: 'newest'
  },
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0
  }
};
```

### Library Actions

```typescript
// library.actions.ts
import { createAction, props } from '@ngrx/store';

// Load library
export const loadLibrary = createAction(
  '[Library] Load Library',
  props<{ filters?: Partial<LibraryState['filters']>; page?: number }>()
);

export const loadLibrarySuccess = createAction(
  '[Library] Load Library Success',
  props<{ items: LibraryItem[]; total: number }>()
);

export const loadLibraryFailure = createAction(
  '[Library] Load Library Failure',
  props<{ error: string }>()
);

// Select item
export const selectLibraryItem = createAction(
  '[Library] Select Item',
  props<{ item: LibraryItem }>()
);

export const deselectLibraryItem = createAction(
  '[Library] Deselect Item'
);

// Delete item
export const deleteLibraryItem = createAction(
  '[Library] Delete Item',
  props<{ id: string }>()
);

export const deleteLibraryItemSuccess = createAction(
  '[Library] Delete Item Success',
  props<{ id: string }>()
);

export const deleteLibraryItemFailure = createAction(
  '[Library] Delete Item Failure',
  props<{ error: string }>()
);

// Download item
export const downloadLibraryItem = createAction(
  '[Library] Download Item',
  props<{ id: string; title: string }>()
);

export const downloadLibraryItemSuccess = createAction(
  '[Library] Download Item Success',
  props<{ id: string }>()
);

// Play item
export const playLibraryItem = createAction(
  '[Library] Play Item',
  props<{ id: string }>()
);

// Update filters
export const updateLibraryFilters = createAction(
  '[Library] Update Filters',
  props<{ filters: Partial<LibraryState['filters']> }>()
);

// Update pagination
export const updateLibraryPagination = createAction(
  '[Library] Update Pagination',
  props<{ page: number }>()
);
```

### Library Reducer

```typescript
// library.reducer.ts
import { createReducer, on } from '@ngrx/store';
import * as LibraryActions from './library.actions';

export const libraryReducer = createReducer(
  initialLibraryState,
  
  // Load library
  on(LibraryActions.loadLibrary, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  
  on(LibraryActions.loadLibrarySuccess, (state, { items, total }) => ({
    ...state,
    items,
    pagination: { ...state.pagination, total },
    loading: false,
    error: null
  })),
  
  on(LibraryActions.loadLibraryFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Select/deselect item
  on(LibraryActions.selectLibraryItem, (state, { item }) => ({
    ...state,
    selectedItem: item
  })),
  
  on(LibraryActions.deselectLibraryItem, (state) => ({
    ...state,
    selectedItem: null
  })),
  
  // Delete item
  on(LibraryActions.deleteLibraryItem, (state) => ({
    ...state,
    loading: true
  })),
  
  on(LibraryActions.deleteLibraryItemSuccess, (state, { id }) => ({
    ...state,
    items: state.items.filter(item => item.id !== id),
    selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    loading: false,
    pagination: { ...state.pagination, total: state.pagination.total - 1 }
  })),
  
  on(LibraryActions.deleteLibraryItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  
  // Play item (increment play count)
  on(LibraryActions.playLibraryItem, (state, { id }) => ({
    ...state,
    items: state.items.map(item =>
      item.id === id
        ? { ...item, playCount: item.playCount + 1 }
        : item
    )
  })),
  
  // Update filters
  on(LibraryActions.updateLibraryFilters, (state, { filters }) => ({
    ...state,
    filters: { ...state.filters, ...filters },
    pagination: { ...state.pagination, page: 1 }  // Reset to page 1 on filter change
  })),
  
  // Update pagination
  on(LibraryActions.updateLibraryPagination, (state, { page }) => ({
    ...state,
    pagination: { ...state.pagination, page }
  }))
);
```

### Library Effects

```typescript
// library.effects.ts
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import * as LibraryActions from './library.actions';
import { LibraryService } from '../../services/library.service';

@Injectable()
export class LibraryEffects {
  private readonly actions$ = inject(Actions);
  private readonly libraryService = inject(LibraryService);

  loadLibrary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.loadLibrary),
      switchMap(({ filters, page }) =>
        this.libraryService.getLibrary(filters, page).pipe(
          map(response => LibraryActions.loadLibrarySuccess({
            items: response.items,
            total: response.total
          })),
          catchError(error => of(LibraryActions.loadLibraryFailure({
            error: error.message || 'Failed to load library'
          })))
        )
      )
    )
  );

  deleteLibraryItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.deleteLibraryItem),
      switchMap(({ id }) =>
        this.libraryService.deleteItem(id).pipe(
          map(() => LibraryActions.deleteLibraryItemSuccess({ id })),
          catchError(error => of(LibraryActions.deleteLibraryItemFailure({
            error: error.message || 'Failed to delete item'
          })))
        )
      )
    )
  );

  downloadLibraryItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.downloadLibraryItem),
      switchMap(({ id, title }) =>
        this.libraryService.downloadItem(id, title).pipe(
          map(() => LibraryActions.downloadLibraryItemSuccess({ id })),
          catchError(error => {
            console.error('Download failed:', error);
            return of({ type: '[Library] Download Item Failure' });
          })
        )
      )
    )
  );

  // Reload library after successful delete
  reloadAfterDelete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.deleteLibraryItemSuccess),
      map(() => LibraryActions.loadLibrary({}))
    )
  );

  // Reload library after filter or pagination change
  reloadOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        LibraryActions.updateLibraryFilters,
        LibraryActions.updateLibraryPagination
      ),
      map(() => LibraryActions.loadLibrary({}))
    )
  );
}
```

### Library Service

```typescript
// library.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LibraryItem } from '../store/library/library.state';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/library`;

  getLibrary(filters?: any, page?: number): Observable<{ items: LibraryItem[]; total: number }> {
    let params = new HttpParams();
    
    if (filters?.type && filters.type !== 'all') {
      params = params.set('type', filters.type);
    }
    
    if (filters?.search) {
      params = params.set('search', filters.search);
    }
    
    if (filters?.sortBy) {
      params = params.set('sortBy', filters.sortBy);
    }
    
    if (page) {
      params = params.set('page', page.toString());
    }

    return this.http.get<{ items: LibraryItem[]; total: number }>(this.apiUrl, { params });
  }

  getItem(id: string): Observable<LibraryItem> {
    return this.http.get<LibraryItem>(`${this.apiUrl}/${id}`);
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  downloadItem(id: string, title: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob'
    }).pipe(
      tap(blob => {
        // Trigger browser download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.mp3`;  // Or extract extension from response
        link.click();
        window.URL.revokeObjectURL(url);
      })
    );
  }
}
```

### Library Page Component

```typescript
// library-page.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AppState } from '../../store/app.state';
import * as fromLibrary from '../../store/library/library.selectors';
import * as LibraryActions from '../../store/library/library.actions';
import { LibraryItem } from '../../store/library/library.state';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'harmonia-library-page',
  standalone: false,
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss',
})
export class LibraryPageComponent implements OnInit {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);

  items$ = this.store.select(fromLibrary.selectLibraryItems);
  filteredItems$ = this.store.select(fromLibrary.selectFilteredLibraryItems);
  selectedItem$ = this.store.select(fromLibrary.selectSelectedItem);
  loading$ = this.store.select(fromLibrary.selectLibraryLoading);
  error$ = this.store.select(fromLibrary.selectLibraryError);
  filters$ = this.store.select(fromLibrary.selectLibraryFilters);
  pagination$ = this.store.select(fromLibrary.selectLibraryPagination);

  viewMode: 'grid' | 'list' = 'grid';

  ngOnInit(): void {
    this.store.dispatch(LibraryActions.loadLibrary({}));
  }

  onFilterChange(type: string): void {
    this.store.dispatch(LibraryActions.updateLibraryFilters({ filters: { type: type as any } }));
  }

  onSearchChange(search: string): void {
    this.store.dispatch(LibraryActions.updateLibraryFilters({ filters: { search } }));
  }

  onSortChange(sortBy: string): void {
    this.store.dispatch(LibraryActions.updateLibraryFilters({ filters: { sortBy: sortBy as any } }));
  }

  onPageChange(page: number): void {
    this.store.dispatch(LibraryActions.updateLibraryPagination({ page }));
  }

  onPlayItem(item: LibraryItem): void {
    this.store.dispatch(LibraryActions.selectLibraryItem({ item }));
    this.store.dispatch(LibraryActions.playLibraryItem({ id: item.id }));
  }

  onDownloadItem(item: LibraryItem): void {
    this.store.dispatch(LibraryActions.downloadLibraryItem({ 
      id: item.id, 
      title: item.title 
    }));
  }

  onDeleteItem(item: LibraryItem): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Item',
        message: `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.store.dispatch(LibraryActions.deleteLibraryItem({ id: item.id }));
      }
    });
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
```

### Library Page Template

```html
<!-- library-page.component.html -->
<div class="library-page">
  <div class="library-header">
    <h1>My Library</h1>
    <p class="subtitle">Your generated music collection</p>
  </div>

  <!-- Toolbar -->
  <mat-toolbar class="library-toolbar">
    <!-- Filters -->
    <mat-button-toggle-group 
      [value]="(filters$ | async)?.type"
      (change)="onFilterChange($event.value)"
      class="filter-group"
    >
      <mat-button-toggle value="all">All</mat-button-toggle>
      <mat-button-toggle value="song">Songs</mat-button-toggle>
      <mat-button-toggle value="music">Music</mat-button-toggle>
      <mat-button-toggle value="audio">Audio</mat-button-toggle>
      <mat-button-toggle value="style">Styles</mat-button-toggle>
    </mat-button-toggle-group>

    <span class="spacer"></span>

    <!-- Search -->
    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search</mat-label>
      <input 
        matInput 
        [value]="(filters$ | async)?.search"
        (input)="onSearchChange($event.target.value)"
        placeholder="Search by title or genre"
      >
      <mat-icon matPrefix>search</mat-icon>
    </mat-form-field>

    <!-- Sort -->
    <mat-form-field appearance="outline" class="sort-field">
      <mat-label>Sort by</mat-label>
      <mat-select 
        [value]="(filters$ | async)?.sortBy"
        (selectionChange)="onSortChange($event.value)"
      >
        <mat-option value="newest">Newest First</mat-option>
        <mat-option value="oldest">Oldest First</mat-option>
        <mat-option value="title">Title</mat-option>
        <mat-option value="mostPlayed">Most Played</mat-option>
      </mat-select>
    </mat-form-field>

    <!-- View Mode Toggle -->
    <button 
      mat-icon-button 
      (click)="toggleViewMode()"
      [matTooltip]="viewMode === 'grid' ? 'List View' : 'Grid View'"
    >
      <mat-icon>{{ viewMode === 'grid' ? 'view_list' : 'view_module' }}</mat-icon>
    </button>
  </mat-toolbar>

  <!-- Loading State -->
  <div *ngIf="loading$ | async" class="loading-container">
    <mat-spinner></mat-spinner>
    <p>Loading your library...</p>
  </div>

  <!-- Error State -->
  <div *ngIf="error$ | async as error" class="error-container">
    <mat-icon color="warn">error</mat-icon>
    <p>{{ error }}</p>
    <button mat-raised-button color="primary" (click)="ngOnInit()">
      Retry
    </button>
  </div>

  <!-- Empty State -->
  <div *ngIf="!(loading$ | async) && (filteredItems$ | async)?.length === 0" class="empty-container">
    <mat-icon>library_music</mat-icon>
    <h2>No items in your library</h2>
    <p>Start generating music to build your collection!</p>
    <button mat-raised-button color="primary" routerLink="/generate/song">
      Generate Song
    </button>
  </div>

  <!-- Grid View -->
  <div *ngIf="viewMode === 'grid' && !(loading$ | async) && (filteredItems$ | async)?.length! > 0" class="library-grid">
    <mat-card *ngFor="let item of filteredItems$ | async" class="library-card">
      <mat-card-header>
        <mat-card-title>{{ item.title }}</mat-card-title>
        <mat-card-subtitle>
          <mat-chip-set>
            <mat-chip>{{ item.type }}</mat-chip>
            <mat-chip *ngIf="item.metadata?.genre">{{ item.metadata.genre }}</mat-chip>
          </mat-chip-set>
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <div class="waveform-placeholder" *ngIf="item.type !== 'style'">
          <mat-icon>audiotrack</mat-icon>
        </div>

        <div class="item-metadata">
          <span *ngIf="item.duration">
            <mat-icon>schedule</mat-icon>
            {{ formatDuration(item.duration) }}
          </span>
          <span *ngIf="item.fileSize">
            <mat-icon>storage</mat-icon>
            {{ formatFileSize(item.fileSize) }}
          </span>
          <span *ngIf="item.playCount > 0">
            <mat-icon>play_circle</mat-icon>
            {{ item.playCount }} plays
          </span>
        </div>

        <p class="item-description" *ngIf="item.description">
          {{ item.description }}
        </p>
      </mat-card-content>

      <mat-card-actions>
        <button 
          mat-button 
          color="primary"
          (click)="onPlayItem(item)"
          *ngIf="item.type !== 'style'"
        >
          <mat-icon>play_arrow</mat-icon>
          Play
        </button>
        <button 
          mat-button 
          (click)="onDownloadItem(item)"
        >
          <mat-icon>download</mat-icon>
          Download
        </button>
        <button 
          mat-button 
          color="warn"
          (click)="onDeleteItem(item)"
        >
          <mat-icon>delete</mat-icon>
          Delete
        </button>
      </mat-card-actions>

      <div class="item-footer">
        <span class="created-date">
          {{ item.createdAt | date:'short' }}
        </span>
      </div>
    </mat-card>
  </div>

  <!-- List View -->
  <div *ngIf="viewMode === 'list' && !(loading$ | async) && (filteredItems$ | async)?.length! > 0" class="library-list">
    <mat-list>
      <mat-list-item *ngFor="let item of filteredItems$ | async" class="library-list-item">
        <mat-icon matListItemIcon>{{ item.type === 'style' ? 'style' : 'audiotrack' }}</mat-icon>
        
        <div matListItemTitle>{{ item.title }}</div>
        <div matListItemLine>
          <span class="item-meta">
            {{ item.type }} • 
            <span *ngIf="item.metadata?.genre">{{ item.metadata.genre }} • </span>
            {{ formatDuration(item.duration) }} • 
            {{ formatFileSize(item.fileSize) }}
          </span>
        </div>
        
        <div matListItemMeta class="item-actions">
          <button 
            mat-icon-button 
            (click)="onPlayItem(item)"
            *ngIf="item.type !== 'style'"
            matTooltip="Play"
          >
            <mat-icon>play_arrow</mat-icon>
          </button>
          <button 
            mat-icon-button 
            (click)="onDownloadItem(item)"
            matTooltip="Download"
          >
            <mat-icon>download</mat-icon>
          </button>
          <button 
            mat-icon-button 
            color="warn"
            (click)="onDeleteItem(item)"
            matTooltip="Delete"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </mat-list-item>
    </mat-list>
  </div>

  <!-- Pagination -->
  <mat-paginator
    *ngIf="(pagination$ | async) as pagination"
    [length]="pagination.total"
    [pageSize]="pagination.pageSize"
    [pageIndex]="pagination.page - 1"
    (page)="onPageChange($event.pageIndex + 1)"
    [pageSizeOptions]="[10, 20, 50, 100]"
  ></mat-paginator>

  <!-- Audio Player (Fixed Bottom) -->
  <div *ngIf="selectedItem$ | async as item" class="audio-player-container">
    <harmonia-audio-player 
      [item]="item"
      (close)="store.dispatch(LibraryActions.deselectLibraryItem())"
    ></harmonia-audio-player>
  </div>
</div>
```

### Audio Player Component

```typescript
// audio-player.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { LibraryItem } from '../../store/library/library.state';

@Component({
  selector: 'harmonia-audio-player',
  standalone: false,
  templateUrl: './audio-player.component.html',
  styleUrl: './audio-player.component.scss',
})
export class AudioPlayerComponent implements OnInit, OnDestroy {
  @Input() item!: LibraryItem;
  @Output() close = new EventEmitter<void>();

  audio: HTMLAudioElement | null = null;
  isPlaying = false;
  currentTime = 0;
  duration = 0;
  volume = 1;
  isMuted = false;

  ngOnInit(): void {
    this.audio = new Audio(this.item.fileUrl);
    
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio!.duration;
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio!.currentTime;
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.currentTime = 0;
    });

    // Auto-play
    this.togglePlayPause();
  }

  ngOnDestroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  togglePlayPause(): void {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
    this.isPlaying = !this.isPlaying;
  }

  seek(event: any): void {
    if (!this.audio) return;
    this.audio.currentTime = event.value;
  }

  setVolume(event: any): void {
    if (!this.audio) return;
    this.volume = event.value;
    this.audio.volume = this.volume;
  }

  toggleMute(): void {
    if (!this.audio) return;
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
  }

  onClose(): void {
    this.close.emit();
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
```

### Audio Player Template

```html
<!-- audio-player.component.html -->
<mat-card class="audio-player">
  <div class="player-header">
    <div class="track-info">
      <mat-icon>audiotrack</mat-icon>
      <div>
        <div class="track-title">{{ item.title }}</div>
        <div class="track-subtitle">{{ item.metadata?.genre || 'Unknown Genre' }}</div>
      </div>
    </div>
    <button mat-icon-button (click)="onClose()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <div class="player-controls">
    <button mat-icon-button (click)="togglePlayPause()" class="play-button">
      <mat-icon>{{ isPlaying ? 'pause' : 'play_arrow' }}</mat-icon>
    </button>

    <div class="time-display">
      {{ formatTime(currentTime) }}
    </div>

    <mat-slider 
      [min]="0" 
      [max]="duration"
      [value]="currentTime"
      (input)="seek($event)"
      class="progress-slider"
    >
      <input matSliderThumb>
    </mat-slider>

    <div class="time-display">
      {{ formatTime(duration) }}
    </div>

    <button mat-icon-button (click)="toggleMute()" class="volume-button">
      <mat-icon>{{ isMuted ? 'volume_off' : 'volume_up' }}</mat-icon>
    </button>

    <mat-slider 
      [min]="0" 
      [max]="1" 
      [step]="0.01"
      [value]="volume"
      (input)="setVolume($event)"
      class="volume-slider"
    >
      <input matSliderThumb>
    </mat-slider>
  </div>
</mat-card>
```

## Backend Implementation

### Library Controller

```typescript
// library.controller.ts
import { 
  Controller, 
  Get, 
  Delete, 
  Param, 
  Query, 
  UseGuards,
  Req,
  Res,
  StreamableFile
} from '@nestjs/common';
import { Response } from 'express';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { createReadStream } from 'fs';
import { join } from 'path';

@Controller('api/library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  async getLibrary(
    @CurrentUser() user: any,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string
  ) {
    const filters = {
      type: type || 'all',
      search: search || '',
      sortBy: sortBy || 'newest'
    };
    const pageNum = page ? parseInt(page) : 1;
    
    return this.libraryService.findByUserId(user.sub, filters, pageNum);
  }

  @Get(':id')
  async getLibraryItem(
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    return this.libraryService.findById(id, user.sub);
  }

  @Delete(':id')
  async deleteLibraryItem(
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    await this.libraryService.delete(id, user.sub);
    return { message: 'Item deleted successfully' };
  }

  @Get(':id/download')
  async downloadLibraryItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const item = await this.libraryService.findById(id, user.sub);
    
    // Increment download count
    await this.libraryService.incrementDownloadCount(id);
    
    // Stream file
    const file = createReadStream(item.fileUrl);
    const filename = `${item.title}.${item.fileType}`;
    
    res.set({
      'Content-Type': `audio/${item.fileType}`,
      'Content-Disposition': `attachment; filename="${filename}"`
    });

    return new StreamableFile(file);
  }
}
```

### Backend Library Service

```typescript
// library.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LibraryItem, LibraryItemDocument } from '../schemas/library-item.schema';

@Injectable()
export class LibraryService {
  constructor(
    @InjectModel(LibraryItem.name) 
    private libraryItemModel: Model<LibraryItemDocument>
  ) {}

  async findByUserId(userId: string, filters: any, page: number) {
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    // Build query
    const query: any = { userId };

    if (filters.type && filters.type !== 'all') {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    // Build sort
    let sort: any = { createdAt: -1 };  // Default: newest first
    
    if (filters.sortBy === 'oldest') {
      sort = { createdAt: 1 };
    } else if (filters.sortBy === 'title') {
      sort = { title: 1 };
    } else if (filters.sortBy === 'mostPlayed') {
      sort = { playCount: -1 };
    }

    // Execute query with pagination
    const [items, total] = await Promise.all([
      this.libraryItemModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.libraryItemModel.countDocuments(query)
    ]);

    return {
      items: items.map(item => this.mapToDto(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async findById(id: string, userId: string) {
    const item = await this.libraryItemModel.findById(id);

    if (!item) {
      throw new NotFoundException('Library item not found');
    }

    // Ensure user owns this item
    if (item.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this item');
    }

    return this.mapToDto(item);
  }

  async delete(id: string, userId: string) {
    const item = await this.findById(id, userId);
    
    // Delete file from storage (S3 or local filesystem)
    await this.deleteFile(item.fileUrl);

    // Delete from database
    await this.libraryItemModel.findByIdAndDelete(id);
  }

  async incrementPlayCount(id: string) {
    await this.libraryItemModel.findByIdAndUpdate(
      id,
      { $inc: { playCount: 1 } }
    );
  }

  async incrementDownloadCount(id: string) {
    await this.libraryItemModel.findByIdAndUpdate(
      id,
      { $inc: { downloadCount: 1 } }
    );
  }

  private mapToDto(item: LibraryItemDocument) {
    return {
      id: item._id.toString(),
      userId: item.userId.toString(),
      songId: item.songId?.toString(),
      type: item.type,
      title: item.title,
      description: item.description,
      fileUrl: item.fileUrl,
      fileType: item.fileType,
      fileSize: item.fileSize,
      duration: item.duration,
      thumbnailUrl: item.thumbnailUrl,
      metadata: item.metadata,
      isPublic: item.isPublic,
      playCount: item.playCount,
      downloadCount: item.downloadCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private async deleteFile(fileUrl: string) {
    // TODO: Implement file deletion
    // If S3: await s3.deleteObject(...)
    // If local: await fs.promises.unlink(...)
    console.log('Deleting file:', fileUrl);
  }
}
```

## Route Configuration

```typescript
// library-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LibraryPageComponent } from './library-page.component';
import { authGuard } from '../../guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: LibraryPageComponent,
    canActivate: [authGuard]  // Requires authentication
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LibraryRoutingModule { }
```

## Testing Strategy

### Unit Tests

```typescript
describe('LibraryService', () => {
  it('should filter by type', async () => {
    const result = await service.findByUserId('user123', { type: 'song' }, 1);
    expect(result.items.every(item => item.type === 'song')).toBe(true);
  });

  it('should search by title', async () => {
    const result = await service.findByUserId('user123', { search: 'jazz' }, 1);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should prevent unauthorized access', async () => {
    await expect(service.findById('item123', 'wrong-user'))
      .rejects.toThrow(ForbiddenException);
  });
});
```

### E2E Tests

```typescript
test('library flow', async ({ page }) => {
  // Login
  await page.goto('/');
  await loginUser(page);

  // Navigate to library
  await page.click('[aria-label="User menu"]');
  await page.click('button:has-text("My Library")');
  await expect(page).toHaveURL('/library');

  // Wait for items to load
  await page.waitForSelector('.library-card');

  // Play an item
  await page.click('.library-card >> button:has-text("Play")');
  await expect(page.locator('.audio-player')).toBeVisible();

  // Delete an item
  await page.click('.library-card >> button:has-text("Delete")');
  await page.click('button:has-text("Confirm")');
  await expect(page.locator('.library-card')).toHaveCount(previousCount - 1);
});
```

## Future Enhancements

### Waveform Visualization

- Generate waveform images on upload
- Display interactive waveform for seeking
- Library: peaks.js or wavesurfer.js

### Playlists

- Create custom playlists
- Drag-and-drop reordering
- Share playlists with others

### Favorites & Tags

- Favorite button on items
- Custom tags for organization
- Filter by favorites/tags

### Bulk Operations

- Select multiple items
- Bulk download as ZIP
- Bulk delete

### Cloud Storage Integration

- Upload to Google Drive
- Sync with Dropbox
- Export to SoundCloud

---

**Document Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Status**: Design Complete - Implementation Ready  
**Priority**: HIGH - Core Feature

**LEGENDARY IS OUR STANDARD!** 🎵
