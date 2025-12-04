import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AppState } from '../../store/app.state';
import { LibraryItem, LibraryFilters } from '../../services/library.service';
import * as LibraryActions from '../../store/library/library.state';
import * as LibrarySelectors from '../../store/library/library.selectors';
import { UploadDialogComponent } from './upload-dialog/upload-dialog.component';

/**
 * Library Component
 *
 * Main view for user's music library with file management, search, and upload functionality.
 *
 * @see {@link file://./docs/USER_LIBRARY.md} for full specification
 */
@Component({
  selector: 'harmonia-library',
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss'],
  standalone: false,
})
export class LibraryComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();

  // Observables
  items$: Observable<LibraryItem[]> = this.store.select(
    LibrarySelectors.selectLibraryItemsBySearch
  );
  loading$: Observable<boolean> = this.store.select(
    LibrarySelectors.selectLibraryLoading
  );
  error$: Observable<string | null> = this.store.select(
    LibrarySelectors.selectLibraryError
  );
  filters$: Observable<LibraryFilters> = this.store.select(
    LibrarySelectors.selectLibraryFilters
  );
  pagination$ = this.store.select(LibrarySelectors.selectLibraryPagination);

  // Form controls
  searchControl = new FormControl('');
  viewMode: 'grid' | 'list' = 'grid';

  // Filter options
  typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'song', label: 'Songs' },
    { value: 'music', label: 'Music' },
    { value: 'audio', label: 'Audio' },
    { value: 'style', label: 'Styles' },
  ];

  sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'title', label: 'Title A-Z' },
    { value: 'mostPlayed', label: 'Most Played' },
  ];

  ngOnInit(): void {
    // Load initial library data
    this.store.dispatch(LibraryActions.loadLibrary({}));

    // Setup search with debounce
    this.searchControl.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(300), distinctUntilChanged())
      .subscribe((search) => {
        this.updateFilters({ search: search || undefined });
      });

    // Listen for errors
    this.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
      if (error) {
        this.snackBar.open(error, 'Close', { duration: 5000 });
        this.store.dispatch(LibraryActions.clearError());
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTypeFilterChange(type: string): void {
    this.updateFilters({ type: type as LibraryFilters['type'] });
  }

  onSortChange(sortBy: string): void {
    this.updateFilters({ sortBy: sortBy as LibraryFilters['sortBy'] });
  }

  onPageChange(page: number): void {
    this.store.dispatch(LibraryActions.loadLibrary({ page }));
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  openUploadDialog(): void {
    const dialogRef = this.dialog.open(UploadDialogComponent, {
      width: '600px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.store.dispatch(
          LibraryActions.uploadFile({
            file: result.file,
            itemType: result.type,
            title: result.title,
            description: result.description,
          })
        );
      }
    });
  }

  onItemClick(item: LibraryItem): void {
    // TODO: Open item details or play audio
    console.log('Item clicked:', item);
  }

  onDeleteItem(item: LibraryItem): void {
    if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
      this.store.dispatch(LibraryActions.deleteLibraryItem({ id: item.id }));
    }
  }

  private updateFilters(newFilters: Partial<LibraryFilters>): void {
    this.filters$.pipe(takeUntil(this.destroy$)).subscribe((currentFilters) => {
      const updatedFilters = { ...currentFilters, ...newFilters };
      this.store.dispatch(
        LibraryActions.setFilters({ filters: updatedFilters })
      );
      this.store.dispatch(
        LibraryActions.loadLibrary({ filters: updatedFilters })
      );
    });
  }

  getFileTypeIcon(type: string): string {
    switch (type) {
      case 'song':
        return 'music_note';
      case 'music':
        return 'library_music';
      case 'audio':
        return 'audiotrack';
      case 'style':
        return 'style';
      default:
        return 'insert_drive_file';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
