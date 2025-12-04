import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { LibraryService } from '../../services/library.service';
import * as LibraryActions from './library.state';

@Injectable()
export class LibraryEffects {
  private readonly actions$ = inject(Actions);
  private readonly libraryService = inject(LibraryService);

  loadLibrary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.loadLibrary),
      mergeMap(({ filters, page }) =>
        this.libraryService.getLibrary(filters, page).pipe(
          map((response) => LibraryActions.loadLibrarySuccess({ response })),
          catchError((error) =>
            of(LibraryActions.loadLibraryFailure({ error: error.message }))
          )
        )
      )
    )
  );

  loadLibraryItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.loadLibraryItem),
      mergeMap(({ id }) =>
        this.libraryService.getLibraryItem(id).pipe(
          map((item) => LibraryActions.loadLibraryItemSuccess({ item })),
          catchError((error) =>
            of(LibraryActions.loadLibraryItemFailure({ error: error.message }))
          )
        )
      )
    )
  );

  createLibraryItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.createLibraryItem),
      mergeMap(({ item }) =>
        this.libraryService.createLibraryItem(item).pipe(
          map((createdItem) =>
            LibraryActions.createLibraryItemSuccess({ item: createdItem })
          ),
          catchError((error) =>
            of(
              LibraryActions.createLibraryItemFailure({ error: error.message })
            )
          )
        )
      )
    )
  );

  updateLibraryItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.updateLibraryItem),
      mergeMap(({ id, item }) =>
        this.libraryService.updateLibraryItem(id, item).pipe(
          map((updatedItem) =>
            LibraryActions.updateLibraryItemSuccess({ item: updatedItem })
          ),
          catchError((error) =>
            of(
              LibraryActions.updateLibraryItemFailure({ error: error.message })
            )
          )
        )
      )
    )
  );

  deleteLibraryItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.deleteLibraryItem),
      mergeMap(({ id }) =>
        this.libraryService.deleteLibraryItem(id).pipe(
          map(() => LibraryActions.deleteLibraryItemSuccess({ id })),
          catchError((error) =>
            of(
              LibraryActions.deleteLibraryItemFailure({ error: error.message })
            )
          )
        )
      )
    )
  );

  uploadFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LibraryActions.uploadFile),
      mergeMap(({ file, itemType, title, description }) =>
        this.libraryService
          .uploadFile({
            file,
            type: itemType as 'song' | 'music' | 'audio' | 'style',
            title,
            description,
          })
          .pipe(
            map((item) => LibraryActions.uploadFileSuccess({ item })),
            catchError((error) =>
              of(LibraryActions.uploadFileFailure({ error: error.message }))
            )
          )
      )
    )
  );
}
