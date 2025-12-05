/**
 * Song Generation Effects
 * Reactive effects for backend service integration
 */

import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap } from 'rxjs/operators';
import { SongGenerationService } from '../../services/song-generation.service';
import { SongMetadata, SongGenerationResult, GenerationProgress } from './song-generation.state';
import {
  generateMetadata,
  generateMetadataSuccess,
  generateMetadataFailure,
  generateSong,
  generateSongSuccess,
  generateSongFailure,
  updateProgress,
  addToHistory,
} from './song-generation.actions';

@Injectable()
export class SongGenerationEffects {
  constructor(
    private actions$: Actions,
    private songGenerationService: SongGenerationService
  ) {}

  // Generate metadata effect
  generateMetadata$ = createEffect(() =>
    this.actions$.pipe(
      ofType(generateMetadata),
      mergeMap(({ narrative, duration, model }) =>
        this.songGenerationService.generateMetadata(narrative, duration, model).pipe(
          map((metadata: SongMetadata) => generateMetadataSuccess({ metadata })),
          catchError((error) =>
            of(generateMetadataFailure({
              error: error.message || 'Failed to generate metadata'
            }))
          )
        )
      )
    )
  );

  // Generate song effect
  generateSong$ = createEffect(() =>
    this.actions$.pipe(
      ofType(generateSong),
      mergeMap(({ narrative, duration, model }) =>
        this.songGenerationService.generateSong(narrative, duration, model).pipe(
          map((result: SongGenerationResult) => generateSongSuccess({ result })),
          catchError((error) =>
            of(generateSongFailure({
              error: error.message || 'Failed to generate song'
            }))
          )
        )
      )
    )
  );

  // Add successful generations to history
  addToHistory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(generateSongSuccess),
      map(({ result }) => addToHistory({ result }))
    )
  );

  // Optional: Progress tracking effect (if backend provides progress updates)
  // This would be used if the backend sends progress updates via websockets or polling
  trackProgress$ = createEffect(() =>
    this.actions$.pipe(
      ofType(generateMetadata, generateSong),
      switchMap(() =>
        this.songGenerationService.getProgressUpdates().pipe(
          map((progress: GenerationProgress) => updateProgress({ progress })),
          catchError(() => of()) // Ignore progress update errors
        )
      )
    )
  );
}