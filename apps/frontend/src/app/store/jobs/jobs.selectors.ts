/**
 * Jobs Selectors
 * Memoized selectors for job state access
 */

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { JobsState, JobStatus, JobType } from './jobs.state';
import * as fromJobs from './jobs.reducer';

export const selectJobsState = createFeatureSelector<JobsState>('jobs');

// Entity adapter selectors
export const selectAllJobs = createSelector(selectJobsState, fromJobs.selectAll);

export const selectJobsEntities = createSelector(
  selectJobsState,
  fromJobs.selectEntities
);

export const selectJobsIds = createSelector(
  selectJobsState,
  fromJobs.selectIds
);

export const selectJobsTotal = createSelector(
  selectJobsState,
  fromJobs.selectTotal
);

// UI state selectors
export const selectJobsLoading = createSelector(
  selectJobsState,
  (state) => state.loading
);

export const selectJobsError = createSelector(
  selectJobsState,
  (state) => state.error
);

export const selectRealTimeUpdatesEnabled = createSelector(
  selectJobsState,
  (state) => state.realTimeUpdatesEnabled
);

export const selectSelectedJobId = createSelector(
  selectJobsState,
  (state) => state.selectedJobId
);

export const selectSelectedJob = createSelector(
  selectJobsEntities,
  selectSelectedJobId,
  (entities, selectedId) => (selectedId ? entities[selectedId] : null)
);

// Filter selectors
export const selectJobsFilters = createSelector(
  selectJobsState,
  (state) => state.filters
);

export const selectStatusFilter = createSelector(
  selectJobsFilters,
  (filters) => filters.status
);

export const selectTypeFilter = createSelector(
  selectJobsFilters,
  (filters) => filters.jobType
);

export const selectUserFilter = createSelector(
  selectJobsFilters,
  (filters) => filters.userId
);

// Derived selectors - filtered jobs
export const selectFilteredJobs = createSelector(
  selectAllJobs,
  selectJobsFilters,
  (jobs, filters) => {
    return jobs.filter((job) => {
      const matchesStatus = !filters.status || job.status === filters.status;
      const matchesType = !filters.jobType || job.jobType === filters.jobType;
      const matchesUser = !filters.userId || job.userId === filters.userId;

      return matchesStatus && matchesType && matchesUser;
    });
  }
);

// Job by ID selector factory
export const selectJobById = (id: string) =>
  createSelector(selectJobsEntities, (entities) => entities[id]);

// Jobs by status
export const selectJobsByStatus = (status: JobStatus) =>
  createSelector(selectAllJobs, (jobs) =>
    jobs.filter((job) => job.status === status)
  );

// Active jobs (processing or queued)
export const selectActiveJobs = createSelector(selectAllJobs, (jobs) =>
  jobs.filter((job) => job.status === 'processing' || job.status === 'queued')
);

// Pending jobs count
export const selectPendingJobsCount = createSelector(
  selectAllJobs,
  (jobs) => jobs.filter((job) => job.status === 'pending').length
);

// Processing jobs count
export const selectProcessingJobsCount = createSelector(
  selectAllJobs,
  (jobs) => jobs.filter((job) => job.status === 'processing').length
);

// Completed jobs today
export const selectCompletedJobsToday = createSelector(
  selectAllJobs,
  (jobs) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return jobs.filter((job) => {
      if (job.status !== 'completed' || !job.completedAt) return false;
      const completedDate = new Date(job.completedAt);
      return completedDate >= today;
    });
  }
);

// Failed jobs
export const selectFailedJobs = createSelector(selectAllJobs, (jobs) =>
  jobs.filter((job) => job.status === 'failed')
);

// Jobs by type
export const selectJobsByType = (jobType: JobType) =>
  createSelector(selectAllJobs, (jobs) =>
    jobs.filter((job) => job.jobType === jobType)
  );

// Average job duration (for completed jobs)
export const selectAverageJobDuration = createSelector(
  selectAllJobs,
  (jobs) => {
    const completedJobs = jobs.filter(
      (job) => job.status === 'completed' && job.startedAt && job.completedAt
    );

    if (completedJobs.length === 0) return null;

    const totalDuration = completedJobs.reduce((sum, job) => {
      const start = new Date(job.startedAt!).getTime();
      const end = new Date(job.completedAt!).getTime();
      return sum + (end - start);
    }, 0);

    return totalDuration / completedJobs.length;
  }
);

// Queue position for a specific job
export const selectJobQueuePosition = (jobId: string) =>
  createSelector(selectAllJobs, (jobs) => {
    const queuedJobs = jobs
      .filter((job) => job.status === 'queued' || job.status === 'pending')
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt.localeCompare(b.createdAt);
      });

    const position = queuedJobs.findIndex((job) => job.id === jobId);
    return position === -1 ? null : position + 1;
  });
