import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Queue } from 'bull';
import type { Model } from 'mongoose';
import type { JobsGateway } from '../app/gateways/jobs.gateway';
import type { MusicRuntimeService } from '../music-runtime/music-runtime.service';
import type { JobRecordDocument } from '../schemas/job-record.schema';
import { JobsService } from './jobs.service';

describe('JobsService generation contract', () => {
  const service = new JobsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  function validGenerate(overrides: Record<string, unknown> = {}) {
    return {
      jobType: 'generate' as const,
      modelId: 'musicgen-small',
      parameters: {
        duration: 5,
        genre: 'rock',
        mood: 'energetic',
        bpm: 120,
        instruments: ['guitar_electric', 'drums'],
        ...overrides,
      },
    };
  }

  it('accepts a real MusicGen generation request', () => {
    expect(() =>
      (service as any).validateGenerationRequest(validGenerate())
    ).not.toThrow();
  });

  it('accepts ACE-Step generation with supplied lyrics at 30 seconds', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'acestep-v15-turbo-06b',
        parameters: {
          title: 'Phase 12D',
          prompt:
            'uplifting alternative rock with electric guitar and steady drums',
          lyrics:
            '[Verse]\nRunning north beneath the open sky\n[Chorus]\nTrue north keeps us moving',
          duration: 30,
          bpm: 118,
        },
      })
    ).not.toThrow();
  });

  it('rejects ACE-Step generation without supplied lyrics', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'acestep-v15-turbo-06b',
        parameters: {
          prompt: 'alternative rock',
          duration: 30,
          bpm: 118,
        },
      })
    ).toThrow(
      'ACE-Step generation requires supplied lyrics.'
    );
  });

  it('enforces the ACE-Step 10 second upstream minimum duration', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'acestep-v15-turbo-06b',
        parameters: {
          prompt: 'alternative rock',
          lyrics: 'Keep moving forward',
          duration: 9,
        },
      })
    ).toThrow(
      'Generation duration must be at least 10 seconds.'
    );
  });

  it('accepts DiffRhythm Base generation with prompt, lyrics, and exact 95-second duration', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          title: 'DiffRhythm E3',
          prompt:
            'cinematic electronic rock with wide stereo production',
          lyrics:
            '[00:00.00] Northern lights above the plain\\n[00:48.00] Carry the rhythm home again',
          duration: 95,
          seed: 1604,
        },
      })
    ).not.toThrow();
  });

  it('accepts DiffRhythm Base generation without an explicit seed', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'atmospheric synth rock',
          lyrics:
            '[00:00.00] Midnight current on the line',
          duration: 95,
        },
      })
    ).not.toThrow();
  });

  it('rejects DiffRhythm generation without supplied lyrics', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'cinematic electronic rock',
          duration: 95,
        },
      })
    ).toThrow(
      'DiffRhythm generation requires supplied lyrics.'
    );
  });

  it('rejects DiffRhythm Base generation unless duration is exactly 95 seconds', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'cinematic electronic rock',
          lyrics:
            '[00:00.00] Northern lights',
          duration: 94,
        },
      })
    ).toThrow(
      'DiffRhythm v1.2 Base generation requires exactly 95 seconds.'
    );
  });

  it('rejects an invalid DiffRhythm seed', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'cinematic electronic rock',
          lyrics:
            '[00:00.00] Northern lights',
          duration: 95,
          seed: -1,
        },
      })
    ).toThrow(
      'DiffRhythm seed must be a non-negative integer.'
    );
  });

  it('rejects generation without a model', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        parameters: { duration: 5, prompt: 'ambient piano' },
      })
    ).toThrow(BadRequestException);
  });

  it('rejects generation beyond the selected model duration', () => {
    expect(() =>
      (service as any).validateGenerationRequest(
        validGenerate({ duration: 121 })
      )
    ).toThrow('MusicGen Small supports at most 120 seconds.');
  });

  it('builds a descriptive prompt from generation parameters', () => {
    expect(
      (service as any).buildGenerationPrompt(
        validGenerate().parameters
      )
    ).toBe(
      'rock music, energetic mood, 120 BPM, featuring guitar electric, drums'
    );
  });

  it('rejects an artifact that is not a WAV file', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'harmonia-job-test-')
    );
    const filePath = path.join(tempDir, 'fake.wav');
    await fs.writeFile(filePath, Buffer.from('not audio'));

    await expect(
      (service as any).validateWav(filePath, 5)
    ).rejects.toThrow('too small to be a valid WAV');

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('validates PCM WAV metadata and requested duration', async () => {
    const sampleRate = 32000;
    const seconds = 1;
    const dataBytes = sampleRate * seconds * 2;
    const wav = Buffer.alloc(44 + dataBytes);
    wav.write('RIFF', 0, 'ascii');
    wav.writeUInt32LE(36 + dataBytes, 4);
    wav.write('WAVE', 8, 'ascii');
    wav.write('fmt ', 12, 'ascii');
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36, 'ascii');
    wav.writeUInt32LE(dataBytes, 40);

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'harmonia-job-test-')
    );
    const filePath = path.join(tempDir, 'valid.wav');
    await fs.writeFile(filePath, wav);

    await expect(
      (service as any).validateWav(filePath, 1)
    ).resolves.toMatchObject({
      channels: 1,
      sampleRate,
      bitsPerSample: 16,
      durationSeconds: 1,
      size: wav.length,
    });

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});

describe('JobsService durable restart reconciliation', () => {
  const jobId =
    '507f1f77bcf86cd799439011';

  const userId =
    '507f191e810c19729de860ea';

  interface ReconciliationProbe {
    reconcileGenerationQueue(): Promise<void>;
  }

  interface ArtifactRecoveryProbe {
    validateWav(
      filePath: string,
      requestedDurationSeconds: number
    ): Promise<{
      channels: number;
      sampleRate: number;
      bitsPerSample: number;
      durationSeconds: number;
      size: number;
    }>;
  }

  function reconciliationProbe(
    service: JobsService
  ): ReconciliationProbe {
    return service as unknown as ReconciliationProbe;
  }

  function artifactRecoveryProbe(
    service: JobsService
  ): ArtifactRecoveryProbe {
    return service as unknown as ArtifactRecoveryProbe;
  }

  function makeJob(
    status: 'queued' | 'processing'
  ) {
    return {
      _id: {
        toString: () => jobId,
      },
      userId: {
        toString: () => userId,
      },
      status,
      startedAt:
        status === 'processing'
          ? new Date()
          : null,
      progress: null,
      modelId:
        'stable-audio-3-small-music',
      parameters: {
        title:
          'Signal Bloom',
        duration: 15,
        prompt:
          'cinematic electronic post-rock instrumental',
      },
      result: null,
      completedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeHarness(
    jobs: ReturnType<typeof makeJob>[],
    existingBullJob: unknown = null
  ) {
    const exec =
      jest.fn().mockResolvedValue(jobs);

    const find =
      jest.fn().mockReturnValue({
        exec,
      });

    const generationQueue = {
      isReady:
        jest.fn().mockResolvedValue(undefined),
      getJob:
        jest.fn().mockResolvedValue(existingBullJob),
      add:
        jest.fn().mockResolvedValue({}),
    };

    const gateway = {
      server: {},
      emitJobCompleted:
        jest.fn(),
    };

    const service = new JobsService(
      { find } as unknown as Model<JobRecordDocument>,
      gateway as unknown as JobsGateway,
      {} as unknown as MusicRuntimeService,
      generationQueue as unknown as Queue
    );

    return {
      service,
      find,
      exec,
      generationQueue,
      gateway,
    };
  }

  it('waits for Bull before startup reconciliation', async () => {
    const harness = makeHarness([]);
    const callOrder: string[] = [];

    harness.generationQueue.isReady
      .mockImplementation(async () => {
        callOrder.push('bull-ready');
      });

    const reconcile = jest
      .spyOn(
        reconciliationProbe(harness.service),
        'reconcileGenerationQueue'
      )
      .mockImplementation(async () => {
        callOrder.push('reconcile');
      });

    await harness.service.onModuleInit();

    expect(
      harness.generationQueue.isReady
    ).toHaveBeenCalledTimes(1);

    expect(reconcile).toHaveBeenCalledTimes(1);

    expect(callOrder).toEqual([
      'bull-ready',
      'reconcile',
    ]);
  });

  it('scans only queued and processing generation records', async () => {
    const harness = makeHarness([]);

    await reconciliationProbe(
      harness.service
    ).reconcileGenerationQueue();

    expect(harness.find).toHaveBeenCalledWith({
      jobType: 'generate',
      status: {
        $in: ['queued', 'processing'],
      },
    });

    expect(harness.exec).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue a duplicate when Bull already owns the Mongo job id', async () => {
    const job = makeJob('queued');

    const harness = makeHarness(
      [job],
      { id: jobId }
    );

    await reconciliationProbe(
      harness.service
    ).reconcileGenerationQueue();

    expect(
      harness.generationQueue.getJob
    ).toHaveBeenCalledWith(jobId);

    expect(
      harness.generationQueue.add
    ).not.toHaveBeenCalled();

    expect(job.save).not.toHaveBeenCalled();
  });

  it('re-enqueues an orphaned queued Mongo generation record with the same identity', async () => {
    const job = makeJob('queued');
    const harness = makeHarness([job]);

    await reconciliationProbe(
      harness.service
    ).reconcileGenerationQueue();

    expect(
      harness.generationQueue.add
    ).toHaveBeenCalledWith(
      'generate',
      {
        jobId,
        userId,
      },
      {
        jobId,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    expect(job.save).not.toHaveBeenCalled();
  });

  it('finalizes a valid orphaned artifact without Bull replay', async () => {
    const job =
      makeJob(
        'processing'
      );

    const harness =
      makeHarness(
        [job]
      );

    const validateWav =
      jest
        .spyOn(
          artifactRecoveryProbe(
            harness.service
          ),
          'validateWav'
        )
        .mockResolvedValue({
          channels: 2,
          sampleRate: 44100,
          bitsPerSample: 32,
          durationSeconds: 15,
          size: 5292088,
        });

    await reconciliationProbe(
      harness.service
    ).reconcileGenerationQueue();

    const downloadUrl =
      `/api/jobs/${jobId}/artifact`;

    expect(
      validateWav
    ).toHaveBeenCalledWith(
      path.join(
        process.cwd(),
        'exports',
        'jobs',
        jobId,
        'music.wav'
      ),
      15
    );

    expect(
      job.status
    ).toBe(
      'completed'
    );

    expect(
      job.completedAt
    ).toBeInstanceOf(
      Date
    );

    expect(
      job.progress
    ).toEqual({
      current: 100,
      total: 100,
      percentage: 100,
      message: 'Completed',
    });

    expect(
      job.result
    ).toEqual({
      outputPath:
        downloadUrl,
      metadata: {
        title:
          'Signal Bloom',
        providerId:
          'stable-audio-3',
        modelId:
          'stable-audio-3-small-music',
        recoveredAfterRestart:
          true,
        requestedDurationSeconds:
          15,
        actualDurationSeconds:
          15,
        channels: 2,
        sampleRate: 44100,
        bitsPerSample: 32,
        size: 5292088,
        downloadUrl,
      },
    });

    expect(
      job.save
    ).toHaveBeenCalledTimes(
      1
    );

    expect(
      harness.gateway
        .emitJobCompleted
    ).toHaveBeenCalledTimes(
      1
    );

    expect(
      harness.generationQueue
        .add
    ).not.toHaveBeenCalled();
  });

  it('resets orphaned processing state before durable replay', async () => {
    const job = makeJob('processing');
    const harness = makeHarness([job]);

    jest
      .spyOn(
        artifactRecoveryProbe(
          harness.service
        ),
        'validateWav'
      )
      .mockRejectedValue(
        new Error(
          'No complete recovered artifact'
        )
      );

    const callOrder: string[] = [];

    job.save.mockImplementation(async () => {
      callOrder.push('mongo-save');
    });

    harness.generationQueue.add
      .mockImplementation(async () => {
        callOrder.push('bull-add');
        return {};
      });

    await reconciliationProbe(
      harness.service
    ).reconcileGenerationQueue();

    expect(job.status).toBe('queued');
    expect(job.startedAt).toBeNull();

    expect(job.progress).toEqual({
      current: 0,
      total: 100,
      percentage: 0,
      message:
        'Recovered after backend restart; queued for durable replay',
    });

    expect(job.save).toHaveBeenCalledTimes(1);

    expect(
      harness.generationQueue.add
    ).toHaveBeenCalledTimes(1);

    expect(callOrder).toEqual([
      'mongo-save',
      'bull-add',
    ]);
  });
});

describe('JobsService durable queued cancellation', () => {
  const jobId =
    '507f1f77bcf86cd799439021';

  const userId =
    '507f191e810c19729de860f1';

  interface CancellationProbe {
    findOwnedDocument(
      id: string,
      userId: string
    ): Promise<JobRecordDocument>;
  }

  function cancellationProbe(
    service: JobsService
  ): CancellationProbe {
    return service as unknown as CancellationProbe;
  }

  function makeJob(
    status:
      | 'queued'
      | 'processing'
      | 'completed',
    jobType:
      | 'generate'
      | 'export' =
        'generate'
  ) {
    return {
      _id: {
        toString:
          () => jobId,
      },

      userId: {
        toString:
          () => userId,
      },

      jobType,
      status,
      priority: 0,
      modelId:
        jobType === 'generate'
          ? 'musicgen-small'
          : undefined,
      datasetId:
        undefined,
      parameters: {},
      progress: {
        current: 0,
        total: 100,
        percentage: 0,
        message:
          status === 'processing'
            ? 'Processing'
            : 'Queued',
      },
      result: null,
      createdAt:
        new Date(
          '2026-09-27T22:00:00.000Z'
        ),
      startedAt:
        status === 'processing'
          ? new Date(
              '2026-09-27T22:01:00.000Z'
            )
          : null,
      completedAt:
        status === 'completed'
          ? new Date(
              '2026-09-27T22:02:00.000Z'
            )
          : null,
      estimatedDuration:
        null,
      save:
        jest
          .fn()
          .mockResolvedValue(
            undefined
          ),
    };
  }

  function makeHarness(
    job:
      ReturnType<typeof makeJob>,
    bullJob:
      unknown = null
  ) {
    const generationQueue = {
      getJob:
        jest
          .fn()
          .mockResolvedValue(
            bullJob
          ),
    };

    const gateway = {
      emitJobStatus:
        jest.fn(),
      emitJobStatusToUser:
        jest.fn(),
    };

    const service =
      new JobsService(
        {} as unknown as Model<JobRecordDocument>,
        gateway as unknown as JobsGateway,
        {} as unknown as MusicRuntimeService,
        generationQueue as unknown as Queue
      );

    jest
      .spyOn(
        cancellationProbe(
          service
        ),
        'findOwnedDocument'
      )
      .mockResolvedValue(
        job as unknown as JobRecordDocument
      );

    return {
      service,
      generationQueue,
      gateway,
    };
  }

  it('removes queued Bull generation work before saving Mongo cancellation', async () => {
    const job =
      makeJob(
        'queued'
      );

    const callOrder:
      string[] = [];

    const bullJob = {
      remove:
        jest
          .fn()
          .mockImplementation(
            async () => {
              callOrder.push(
                'bull-remove'
              );
            }
          ),
    };

    job.save
      .mockImplementation(
        async () => {
          callOrder.push(
            'mongo-save'
          );
        }
      );

    const harness =
      makeHarness(
        job,
        bullJob
      );

    const result =
      await harness.service.cancel(
        jobId,
        userId
      );

    expect(
      harness.generationQueue.getJob
    ).toHaveBeenCalledWith(
      jobId
    );

    expect(
      bullJob.remove
    ).toHaveBeenCalledTimes(
      1
    );

    expect(
      callOrder
    ).toEqual([
      'bull-remove',
      'mongo-save',
    ]);

    expect(
      job.status
    ).toBe(
      'cancelled'
    );

    expect(
      result.status
    ).toBe(
      'cancelled'
    );

    expect(
      harness.gateway.emitJobStatus
    ).toHaveBeenCalledWith(
      jobId,
      'cancelled'
    );

    expect(
      harness.gateway.emitJobStatusToUser
    ).toHaveBeenCalledWith(
      userId,
      jobId,
      'cancelled'
    );
  });

  it('still cancels queued Mongo generation when Bull no longer has the job', async () => {
    const job =
      makeJob(
        'queued'
      );

    const harness =
      makeHarness(
        job,
        null
      );

    const result =
      await harness.service.cancel(
        jobId,
        userId
      );

    expect(
      harness.generationQueue.getJob
    ).toHaveBeenCalledWith(
      jobId
    );

    expect(
      job.save
    ).toHaveBeenCalledTimes(
      1
    );

    expect(
      job.status
    ).toBe(
      'cancelled'
    );

    expect(
      result.status
    ).toBe(
      'cancelled'
    );
  });

  it('does not touch Bull for a queued non-generation job', async () => {
    const job =
      makeJob(
        'queued',
        'export'
      );

    const harness =
      makeHarness(
        job,
        null
      );

    await harness.service.cancel(
      jobId,
      userId
    );

    expect(
      harness.generationQueue.getJob
    ).not.toHaveBeenCalled();

    expect(
      job.status
    ).toBe(
      'cancelled'
    );
  });

  it('rejects processing generation before any Bull mutation', async () => {
    const job =
      makeJob(
        'processing'
      );

    const bullJob = {
      remove:
        jest.fn(),
    };

    const harness =
      makeHarness(
        job,
        bullJob
      );

    await expect(
      harness.service.cancel(
        jobId,
        userId
      )
    ).rejects.toThrow(
      'Active generation cancellation is not implemented yet.'
    );

    expect(
      harness.generationQueue.getJob
    ).not.toHaveBeenCalled();

    expect(
      bullJob.remove
    ).not.toHaveBeenCalled();

    expect(
      job.save
    ).not.toHaveBeenCalled();
  });
});
