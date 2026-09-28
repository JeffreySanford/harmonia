import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { JobsService } from './jobs.service';

interface GenerationJobData {
  jobId: string;
  userId: string;
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
    const maxAttempts =
      job.opts.attempts || 1;

    await this.jobsService.processGenerationJob(
      job.data.jobId,
      job.data.userId,
      {
        attempt: job.attemptsMade + 1,
        maxAttempts,
      }
    );
  }
}
