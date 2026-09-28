import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { JobsService } from './jobs.service';

interface GenerationJobData {
  jobId: string;
  userId: string;
  attemptOffset: number;
  maxAttempts: number;
}

@Processor('generation')
export class GenerationProcessor {
  constructor(
    private readonly jobsService: JobsService
  ) {}

  @Process({
    name: 'generate',
    concurrency: 1,
  })
  async generate(
    job: Job<GenerationJobData>
  ): Promise<void> {
    if (
      !Number.isInteger(
        job.data.attemptOffset
      ) ||
      job.data.attemptOffset < 0
    ) {
      job.data.attemptOffset = 0;
    }

    if (
      !Number.isInteger(
        job.data.maxAttempts
      ) ||
      job.data.maxAttempts < 1
    ) {
      job.data.maxAttempts =
        job.opts.attempts || 1;
    }

    await this.jobsService.processGenerationJob(
      job.data.jobId,
      job.data.userId,
      {
        attempt:
          job.data.attemptOffset +
          job.attemptsMade +
          1,
        maxAttempts:
          job.data.maxAttempts,
      }
    );
  }
}
