import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, exhaustMap, map, mergeMap } from 'rxjs/operators';
import { MusicRuntimeService } from '../../services/music-runtime.service';
import * as MusicRuntimeActions from './music-runtime.actions';

function errorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error
  ) {
    const payload = (error as { error?: { message?: string } }).error;
    if (payload?.message) {
      return payload.message;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

@Injectable()
export class MusicRuntimeEffects {
  private readonly actions$ = inject(Actions);
  private readonly runtime = inject(MusicRuntimeService);

  loadCatalog$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MusicRuntimeActions.loadCatalog),
      mergeMap(() =>
        this.runtime.getCatalog().pipe(
          map((catalog) =>
            MusicRuntimeActions.loadCatalogSuccess({ catalog })
          ),
          catchError((error) =>
            of(
              MusicRuntimeActions.loadCatalogFailure({
                error: errorMessage(
                  error,
                  'Failed to load music runtime catalog'
                ),
              })
            )
          )
        )
      )
    )
  );

  selectModel$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MusicRuntimeActions.selectModel),
      exhaustMap(({ modelId }) =>
        this.runtime.selectModel(modelId).pipe(
          map((acceptance) =>
            MusicRuntimeActions.selectModelAccepted({ acceptance })
          ),
          catchError((error) =>
            of(
              MusicRuntimeActions.selectModelFailure({
                error: errorMessage(
                  error,
                  'Failed to start selected music runtime'
                ),
              })
            )
          )
        )
      )
    )
  );

  stopRuntime$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MusicRuntimeActions.stopRuntime),
      exhaustMap(() =>
        this.runtime.stopRuntime().pipe(
          map((status) =>
            MusicRuntimeActions.stopRuntimeSuccess({ status })
          ),
          catchError((error) =>
            of(
              MusicRuntimeActions.stopRuntimeFailure({
                error: errorMessage(error, 'Failed to stop music runtime'),
              })
            )
          )
        )
      )
    )
  );
}
