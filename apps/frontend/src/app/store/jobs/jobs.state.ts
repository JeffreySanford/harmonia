/**
 * Jobs State
 * Manages job queue with real-time status updates
 */

import { EntityState } from '@ngrx/entity';

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobType = 'generate' | 'convert' | 'analyze' | 'train';

export interface JobProgress {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface JobResult {
  outputPath?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface Job {
  id: string;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  userId: string;
  modelId?: string;
  datasetId?: string;
  parameters: Record<string, unknown>;
  progress: JobProgress | null;
  result: JobResult | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDuration: number | null;
}

export interface JobsState extends EntityState<Job> {
  selectedJobId: string | null;
  loading: boolean;
  error: string | null;
  filters: {
    status: JobStatus | null;
    jobType: JobType | null;
    userId: string | null;
  };
  realTimeUpdatesEnabled: boolean;
}
