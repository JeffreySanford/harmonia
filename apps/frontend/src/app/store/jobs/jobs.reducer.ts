/**
 * Jobs Reducer
 * Entity adapter for job queue management
 */

import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { Job, JobsState } from './jobs.state';
import * as JobsActions from './jobs.actions';

export const jobsAdapter: EntityAdapter<Job> = createEntityAdapter<Job>({
  selectId: (job) => job.id,
  sortComparer: (a, b) => {
    // Sort by priority (higher first), then by creation date (newer first)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.createdAt.localeCompare(a.createdAt);
  },
});

export const initialJobsState: JobsState = jobsAdapter.getInitialState({
  selectedJobId: null,
  loading: false,
  error: null,
  filters: {
    status: null,
    jobType: null,
    userId: null,
  },
  realTimeUpdatesEnabled: false,
});

export const jobsReducer = createReducer(
  initialJobsState,

  // Load jobs
  on(JobsActions.loadJobs, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(JobsActions.loadJobsSuccess, (state, { jobs }) =>
    jobsAdapter.setAll(jobs, {
      ...state,
      loading: false,
    })
  ),

  on(JobsActions.loadJobsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Load single job
  on(JobsActions.loadJob, (state) => ({
    ...state,
    loading: true,
  })),

  on(JobsActions.loadJobSuccess, (state, { job }) =>
    jobsAdapter.upsertOne(job, {
      ...state,
      loading: false,
    })
  ),

  on(JobsActions.loadJobFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Select/deselect job
  on(JobsActions.selectJob, (state, { id }) => ({
    ...state,
    selectedJobId: id,
  })),

  on(JobsActions.deselectJob, (state) => ({
    ...state,
    selectedJobId: null,
  })),

  // Create job
  on(JobsActions.createJob, (state) => ({
    ...state,
    loading: true,
  })),

  on(JobsActions.createJobSuccess, (state, { job }) =>
    jobsAdapter.addOne(job, {
      ...state,
      loading: false,
    })
  ),

  on(JobsActions.createJobFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Cancel job
  on(JobsActions.cancelJob, (state) => ({
    ...state,
    loading: true,
  })),

  on(JobsActions.cancelJobSuccess, (state, { id }) =>
    jobsAdapter.updateOne(
      {
        id,
        changes: { status: 'cancelled' },
      },
      {
        ...state,
        loading: false,
      }
    )
  ),

  on(JobsActions.cancelJobFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Delete job
  on(JobsActions.deleteJob, (state) => ({
    ...state,
    loading: true,
  })),

  on(JobsActions.deleteJobSuccess, (state, { id }) =>
    jobsAdapter.removeOne(id, {
      ...state,
      loading: false,
    })
  ),

  on(JobsActions.deleteJobFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  // Real-time updates
  on(JobsActions.jobStatusUpdated, (state, { id, status }) =>
    jobsAdapter.updateOne(
      {
        id,
        changes: { status },
      },
      state
    )
  ),

  on(JobsActions.jobProgressUpdated, (state, { id, progress }) =>
    jobsAdapter.updateOne(
      {
        id,
        changes: { progress },
      },
      state
    )
  ),

  on(JobsActions.jobCompleted, (state, { job }) =>
    jobsAdapter.updateOne(
      {
        id: job.id,
        changes: job,
      },
      state
    )
  ),

  on(JobsActions.jobFailed, (state, { id, error }) =>
    jobsAdapter.updateOne(
      {
        id,
        changes: {
          status: 'failed',
          result: { error },
        },
      },
      state
    )
  ),

  // WebSocket connection
  on(JobsActions.enableRealTimeUpdates, (state) => ({
    ...state,
    realTimeUpdatesEnabled: true,
  })),

  on(JobsActions.disableRealTimeUpdates, (state) => ({
    ...state,
    realTimeUpdatesEnabled: false,
  })),

  on(JobsActions.realTimeConnectionEstablished, (state) => state),

  on(JobsActions.realTimeConnectionLost, (state, { error }) => ({
    ...state,
    error,
  })),

  // Filters
  on(JobsActions.setStatusFilter, (state, { status }) => ({
    ...state,
    filters: { ...state.filters, status },
  })),

  on(JobsActions.setTypeFilter, (state, { jobType }) => ({
    ...state,
    filters: { ...state.filters, jobType },
  })),

  on(JobsActions.setUserFilter, (state, { userId }) => ({
    ...state,
    filters: { ...state.filters, userId },
  })),

  on(JobsActions.clearFilters, (state) => ({
    ...state,
    filters: { status: null, jobType: null, userId: null },
  }))
);

export const { selectAll, selectEntities, selectIds, selectTotal } =
  jobsAdapter.getSelectors();
