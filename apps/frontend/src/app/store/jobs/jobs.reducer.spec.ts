import * as JobsActions from './jobs.actions';
import { initialJobsState, jobsReducer } from './jobs.reducer';
import { Job } from './jobs.state';

describe('jobsReducer generation selection', () => {
  const job: Job = {
    id: 'job-1',
    jobType: 'generate',
    status: 'queued',
    priority: 0,
    userId: 'user-1',
    modelId: 'musicgen-small',
    parameters: { prompt: 'rock music', duration: 5 },
    progress: {
      current: 0,
      total: 100,
      percentage: 0,
      message: 'Queued',
    },
    result: null,
    createdAt: '2026-09-23T17:00:00.000Z',
    startedAt: null,
    completedAt: null,
    estimatedDuration: null,
  };

  it('clears stale errors when a new job starts', () => {
    const state = {
      ...initialJobsState,
      error: 'old failure',
    };

    const next = jobsReducer(state, JobsActions.createJob({
      jobType: 'generate',
      modelId: 'musicgen-small',
      parameters: { prompt: 'rock music', duration: 5 },
    }));

    expect(next.loading).toBe(true);
    expect(next.error).toBeNull();
  });

  it('selects a newly created generation job', () => {
    const next = jobsReducer(
      initialJobsState,
      JobsActions.createJobSuccess({ job })
    );

    expect(next.selectedJobId).toBe(job.id);
    expect(next.entities[job.id]).toEqual(job);
    expect(next.loading).toBe(false);
  });
});
