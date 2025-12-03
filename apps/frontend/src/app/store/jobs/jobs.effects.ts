/**
 * Jobs Effects
 * Handles job queue side effects and API calls
 */

import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { JobsService } from '../../services/jobs.service';
import * as JobsActions from './jobs.actions';

@Injectable()
export class JobsEffects {
  private readonly actions$ = inject(Actions);
  private readonly jobsService = inject(JobsService);

  loadJobs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.loadJobs),
      mergeMap(() =>
        this.jobsService.getJobs().pipe(
          map((jobs) => JobsActions.loadJobsSuccess({ jobs })),
          catchError((error) =>
            of(
              JobsActions.loadJobsFailure({
                error: error.message || 'Failed to load jobs',
              })
            )
          )
        )
      )
    )
  );

  loadJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.loadJob),
      mergeMap((action) =>
        this.jobsService.getJobById(action.id).pipe(
          map((job) => JobsActions.loadJobSuccess({ job })),
          catchError((error) =>
            of(
              JobsActions.loadJobFailure({
                error: error.message || 'Failed to load job',
              })
            )
          )
        )
      )
    )
  );

  createJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.createJob),
      mergeMap((action) =>
        this.jobsService
          .createJob({
            jobType: action.jobType,
            parameters: action.parameters,
            priority: action.priority,
            modelId: action.modelId,
            datasetId: action.datasetId,
          })
          .pipe(
            map((job) => JobsActions.createJobSuccess({ job })),
            catchError((error) =>
              of(
                JobsActions.createJobFailure({
                  error: error.message || 'Failed to create job',
                })
              )
            )
          )
      )
    )
  );

  cancelJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.cancelJob),
      mergeMap((action) =>
        this.jobsService.cancelJob(action.id).pipe(
          map(() => JobsActions.cancelJobSuccess({ id: action.id })),
          catchError((error) =>
            of(
              JobsActions.cancelJobFailure({
                error: error.message || 'Failed to cancel job',
              })
            )
          )
        )
      )
    )
  );

  deleteJob$ = createEffect(() =>
    this.actions$.pipe(
      ofType(JobsActions.deleteJob),
      mergeMap((action) =>
        this.jobsService.deleteJob(action.id).pipe(
          map(() => JobsActions.deleteJobSuccess({ id: action.id })),
          catchError((error) =>
            of(
              JobsActions.deleteJobFailure({
                error: error.message || 'Failed to delete job',
              })
            )
          )
        )
      )
    )
  );
}
