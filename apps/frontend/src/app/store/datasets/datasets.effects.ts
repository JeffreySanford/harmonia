/**
 * Datasets Effects
 */

import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { DatasetsService } from '../../services/datasets.service';
import * as DatasetsActions from './datasets.actions';

@Injectable()
export class DatasetsEffects {
  private readonly actions$ = inject(Actions);
  private readonly datasetsService = inject(DatasetsService);

  loadDatasets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.loadDatasets),
      mergeMap(() =>
        this.datasetsService.getDatasets().pipe(
          map((datasets) => DatasetsActions.loadDatasetsSuccess({ datasets })),
          catchError((error) =>
            of(
              DatasetsActions.loadDatasetsFailure({
                error:
                  error instanceof Error ? error.message : 'Failed to load datasets',
              })
            )
          )
        )
      )
    )
  );

  loadDataset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.loadDataset),
      mergeMap(({ id }) =>
        this.datasetsService.getDatasetById(id).pipe(
          map((dataset) => DatasetsActions.loadDatasetSuccess({ dataset })),
          catchError((error) =>
            of(
              DatasetsActions.loadDatasetFailure({
                error:
                  error instanceof Error ? error.message : 'Failed to load dataset',
              })
            )
          )
        )
      )
    )
  );

  loadDatasetSamples$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.loadDatasetSamples),
      mergeMap(({ datasetId, limit, offset }) =>
        this.datasetsService
          .getDatasetSamples(datasetId, { limit, offset })
          .pipe(
            map((samples) =>
              DatasetsActions.loadDatasetSamplesSuccess({ samples })
            ),
            catchError((error) =>
              of(
                DatasetsActions.loadDatasetSamplesFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Failed to load dataset samples',
                })
              )
            )
          )
      )
    )
  );

  createDataset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.createDataset),
      mergeMap(({ dataset }) =>
        this.datasetsService.createDataset(dataset).pipe(
          map((created) =>
            DatasetsActions.createDatasetSuccess({ dataset: created })
          ),
          catchError((error) =>
            of(
              DatasetsActions.createDatasetFailure({
                error:
                  error instanceof Error ? error.message : 'Failed to create dataset',
              })
            )
          )
        )
      )
    )
  );

  updateDataset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.updateDataset),
      mergeMap(({ id, changes }) =>
        this.datasetsService.updateDataset(id, changes).pipe(
          map((dataset) => DatasetsActions.updateDatasetSuccess({ dataset })),
          catchError((error) =>
            of(
              DatasetsActions.updateDatasetFailure({
                error:
                  error instanceof Error ? error.message : 'Failed to update dataset',
              })
            )
          )
        )
      )
    )
  );

  deleteDataset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DatasetsActions.deleteDataset),
      mergeMap(({ id }) =>
        this.datasetsService.deleteDataset(id).pipe(
          map(() => DatasetsActions.deleteDatasetSuccess({ id })),
          catchError((error) =>
            of(
              DatasetsActions.deleteDatasetFailure({
                error:
                  error instanceof Error ? error.message : 'Failed to delete dataset',
              })
            )
          )
        )
      )
    )
  );
}
