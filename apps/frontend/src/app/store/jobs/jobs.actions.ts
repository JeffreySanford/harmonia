/**
 * Jobs Actions
 * Job queue management with real-time updates
 */

import { createAction, props } from '@ngrx/store';
import { Job, JobStatus, JobType, JobProgress } from './jobs.state';

// Load jobs
export const loadJobs = createAction('[Jobs] Load Jobs');

export const loadJobsSuccess = createAction(
  '[Jobs] Load Jobs Success',
  props<{ jobs: Job[] }>()
);

export const loadJobsFailure = createAction(
  '[Jobs] Load Jobs Failure',
  props<{ error: string }>()
);

// Load single job
export const loadJob = createAction(
  '[Jobs] Load Job',
  props<{ id: string }>()
);

export const loadJobSuccess = createAction(
  '[Jobs] Load Job Success',
  props<{ job: Job }>()
);

export const loadJobFailure = createAction(
  '[Jobs] Load Job Failure',
  props<{ error: string }>()
);

// Select job
export const selectJob = createAction(
  '[Jobs] Select Job',
  props<{ id: string }>()
);

export const deselectJob = createAction('[Jobs] Deselect Job');

// Create job
export const createJob = createAction(
  '[Jobs] Create Job',
  props<{
    jobType: JobType;
    parameters: Record<string, unknown>;
    priority?: number;
    modelId?: string;
    datasetId?: string;
  }>()
);

export const createJobSuccess = createAction(
  '[Jobs] Create Job Success',
  props<{ job: Job }>()
);

export const createJobFailure = createAction(
  '[Jobs] Create Job Failure',
  props<{ error: string }>()
);

// Cancel job
export const cancelJob = createAction(
  '[Jobs] Cancel Job',
  props<{ id: string }>()
);

export const cancelJobSuccess = createAction(
  '[Jobs] Cancel Job Success',
  props<{ id: string }>()
);

export const cancelJobFailure = createAction(
  '[Jobs] Cancel Job Failure',
  props<{ error: string }>()
);

// Delete job
export const deleteJob = createAction(
  '[Jobs] Delete Job',
  props<{ id: string }>()
);

export const deleteJobSuccess = createAction(
  '[Jobs] Delete Job Success',
  props<{ id: string }>()
);

export const deleteJobFailure = createAction(
  '[Jobs] Delete Job Failure',
  props<{ error: string }>()
);

// Real-time job updates (via WebSocket)
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

// WebSocket connection
export const enableRealTimeUpdates = createAction(
  '[Jobs] Enable Real-Time Updates'
);

export const disableRealTimeUpdates = createAction(
  '[Jobs] Disable Real-Time Updates'
);

export const realTimeConnectionEstablished = createAction(
  '[Jobs] Real-Time Connection Established'
);

export const realTimeConnectionLost = createAction(
  '[Jobs] Real-Time Connection Lost',
  props<{ error: string }>()
);

// Filter jobs
export const setStatusFilter = createAction(
  '[Jobs] Set Status Filter',
  props<{ status: JobStatus | null }>()
);

export const setTypeFilter = createAction(
  '[Jobs] Set Type Filter',
  props<{ jobType: JobType | null }>()
);

export const setUserFilter = createAction(
  '[Jobs] Set User Filter',
  props<{ userId: string | null }>()
);

export const clearFilters = createAction('[Jobs] Clear Filters');
