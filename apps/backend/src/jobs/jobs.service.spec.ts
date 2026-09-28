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
  interface MusicGenGenerationParameters {
    duration: number;
    genre: string;
    mood: string;
    bpm: number;
    instruments: string[];
  }

  /*
   * These tests exercise pure validation/artifact helper methods.
   * No constructor dependency is used by those helpers, so build
   * the probe directly from the real JobsService prototype instead
   * of fabricating four untyped collaborators.
   */
  const service =
    Object.create(
      JobsService.prototype
    ) as JobsService;

  function validGenerate(
    overrides:
      Partial<MusicGenGenerationParameters> = {}
  ) {
    return {
      jobType: 'generate' as const,
      modelId: 'musicgen-small',
      parameters: {
        duration: 5,
        genre: 'rock',
        mood: 'energetic',
        bpm: 120,
        instruments: [
          'guitar_electric',
          'drums',
        ],
        ...overrides,
      },
    };
  }

  it('accepts a real MusicGen generation request', () => {
    expect(() =>
      service['validateGenerationRequest'](validGenerate())
    ).not.toThrow();
  });

  it('accepts ACE-Step generation with supplied lyrics at 30 seconds', () => {
    expect(() =>
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
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
      service['validateGenerationRequest']({
        jobType: 'generate',
        parameters: { duration: 5, prompt: 'ambient piano' },
      })
    ).toThrow(BadRequestException);
  });

  it('rejects generation beyond the selected model duration', () => {
    expect(() =>
      service['validateGenerationRequest'](
        validGenerate({ duration: 121 })
      )
    ).toThrow('MusicGen Small supports at most 120 seconds.');
  });

  it('builds a descriptive prompt from generation parameters', () => {
    expect(
      service['buildGenerationPrompt'](
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
      service['validateWav'](filePath, 5)
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
      service['validateWav'](filePath, 1)
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
      generationAttempt:
        status === 'processing'
          ? 1
          : 0,
      generationMaxAttempts:
        3,
      generationLastError:
        null as string | null,
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
        attemptOffset: 0,
        maxAttempts: 3,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    expect(job.save).not.toHaveBeenCalled();
  });

  it('preserves a persisted retry offset and recreates only the remaining Bull budget', async () => {
    const job = makeJob('queued');
    job.generationAttempt = 1;
    job.generationLastError =
      'first provider attempt failed';

    const harness =
      makeHarness([job]);

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
        attemptOffset: 1,
        maxAttempts: 3,
      },
      {
        jobId,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    expect(job.save).not.toHaveBeenCalled();
  });

  it('fails an orphan instead of replaying after its persisted retry budget is exhausted', async () => {
    const job = makeJob('queued');
    job.generationAttempt = 3;
    job.generationLastError =
      'third provider attempt failed';

    const harness =
      makeHarness([job]);

    await reconciliationProbe(
      harness.service
    ).reconcileGenerationQueue();

    expect(job.status).toBe(
      'failed'
    );

    expect(job.startedAt).toBeNull();

    expect(
      job.completedAt
    ).toBeInstanceOf(Date);

    expect(job.result).toEqual({
      error:
        'third provider attempt failed',
    });

    expect(job.progress).toEqual({
      current: 0,
      total: 100,
      percentage: 0,
      message:
        'Generation retry budget exhausted after backend restart',
    });

    expect(
      job.generationAttempt
    ).toBe(3);

    expect(
      job.generationMaxAttempts
    ).toBe(3);

    expect(job.save).toHaveBeenCalledTimes(1);

    expect(
      harness.generationQueue.add
    ).not.toHaveBeenCalled();
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
        'Recovered after backend restart; retrying generation attempt 2 of 3',
    });

    expect(job.save).toHaveBeenCalledTimes(1);

    expect(
      harness.generationQueue.add
    ).toHaveBeenCalledTimes(1);

    expect(
      harness.generationQueue.add
    ).toHaveBeenCalledWith(
      'generate',
      {
        jobId,
        userId,
        attemptOffset: 1,
        maxAttempts: 3,
      },
      {
        jobId,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

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

    const musicRuntime = {
      cancelGeneration:
        jest
          .fn()
          .mockResolvedValue(
            {}
          ),
    };

    const service =
      new JobsService(
        {} as unknown as Model<JobRecordDocument>,
        gateway as unknown as JobsGateway,
        musicRuntime as unknown as MusicRuntimeService,
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
      musicRuntime,
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

  it('stops a processing generation provider before saving Mongo cancellation', async () => {
    const job =
      makeJob(
        'processing'
      );

    const harness =
      makeHarness(
        job
      );

    const callOrder:
      string[] = [];

    harness.musicRuntime.cancelGeneration
      .mockImplementation(
        async (
          providerId: string
        ) => {
          callOrder.push(
            'runtime-cancel:' +
              providerId
          );

          const probe =
            harness.service as unknown as {
              activeGenerationCancellations:
                Set<string>;
            };

          expect(
            probe
              .activeGenerationCancellations
              .has(jobId)
          ).toBe(true);

          return {};
        }
      );

    job.save
      .mockImplementation(
        async () => {
          callOrder.push(
            'mongo-save'
          );
        }
      );

    const result =
      await harness.service.cancel(
        jobId,
        userId
      );

    expect(
      harness.musicRuntime
        .cancelGeneration
    ).toHaveBeenCalledWith(
      'musicgen'
    );

    expect(
      harness.generationQueue.getJob
    ).not.toHaveBeenCalled();

    expect(
      callOrder
    ).toEqual([
      'runtime-cancel:musicgen',
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
  });

  it('keeps Mongo processing and clears intent when provider termination fails', async () => {
    const job =
      makeJob(
        'processing'
      );

    const harness =
      makeHarness(
        job
      );

    harness.musicRuntime.cancelGeneration
      .mockRejectedValue(
        new Error(
          'provider stop failed'
        )
      );

    await expect(
      harness.service.cancel(
        jobId,
        userId
      )
    ).rejects.toThrow(
      'provider stop failed'
    );

    expect(
      job.status
    ).toBe(
      'processing'
    );

    expect(
      job.save
    ).not.toHaveBeenCalled();

    const probe =
      harness.service as unknown as {
        activeGenerationCancellations:
          Set<string>;
      };

    expect(
      probe
        .activeGenerationCancellations
        .has(jobId)
    ).toBe(false);
  });

  it('still rejects active cancellation for processing non-generation work', async () => {
    const job =
      makeJob(
        'processing',
        'export'
      );

    const harness =
      makeHarness(
        job
      );

    await expect(
      harness.service.cancel(
        jobId,
        userId
      )
    ).rejects.toThrow(
      'Only active generation jobs can be cancelled.'
    );

    expect(
      harness.musicRuntime
        .cancelGeneration
    ).not.toHaveBeenCalled();

    expect(
      harness.generationQueue.getJob
    ).not.toHaveBeenCalled();

    expect(
      job.save
    ).not.toHaveBeenCalled();
  });
});

describe('JobsService active generation worker cancellation', () => {
  const jobId =
    '507f1f77bcf86cd799439031';

  const userId =
    '507f191e810c19729de860f2';

  interface GenerationProbe {
    findOwnedDocument(
      id: string,
      userId: string
    ): Promise<JobRecordDocument>;

    runMusicGenClient(
      options:
        Record<string, unknown>
    ): Promise<void>;

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

    activeGenerationCancellations:
      Set<string>;
  }

  function makeJob(
    status:
      | 'queued'
      | 'completed'
      | 'failed'
      | 'cancelled' =
        'queued'
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
      jobType:
        'generate',
      status,
      priority:
        0,
      modelId:
        'musicgen-small',
      datasetId:
        undefined,
      parameters: {
        title:
          'D5 synthetic generation',
        prompt:
          'short synthetic unit test',
        duration:
          5,
      },
      progress: {
        current:
          0,
        total:
          100,
        percentage:
          0,
        message:
          'Queued',
      },
      result:
        null,
      createdAt:
        new Date(
          '2026-09-27T23:00:00.000Z'
        ),
      startedAt:
        null,
      completedAt:
        status === 'queued'
          ? null
          : new Date(
              '2026-09-27T23:01:00.000Z'
            ),
      estimatedDuration:
        null,
      generationAttempt:
        0,
      generationMaxAttempts:
        3,
      generationLastError:
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
    status:
      | 'queued'
      | 'completed'
      | 'failed'
      | 'cancelled' =
        'queued'
  ) {
    const job =
      makeJob(
        status
      );

    const gateway = {
      emitJobStatus:
        jest.fn(),
      emitJobStatusToUser:
        jest.fn(),
      emitJobProgress:
        jest.fn(),
      emitJobCompleted:
        jest.fn(),
      emitJobFailed:
        jest.fn(),
    };

    const musicRuntime = {
      selectModel:
        jest
          .fn()
          .mockResolvedValue(
            {}
          ),
      beginGeneration:
        jest
          .fn()
          .mockResolvedValue({
            modelId:
              'musicgen-small',
            modelName:
              'MusicGen Small',
            runtimeModelId:
              'facebook/musicgen-small',
          }),
      finishGeneration:
        jest
          .fn()
          .mockResolvedValue(
            {}
          ),
    };

    const service =
      new JobsService(
        {} as unknown as Model<JobRecordDocument>,
        gateway as unknown as JobsGateway,
        musicRuntime as unknown as MusicRuntimeService,
        {} as unknown as Queue
      );

    const probe =
      service as unknown as GenerationProbe;

    jest
      .spyOn(
        probe,
        'findOwnedDocument'
      )
      .mockResolvedValue(
        job as unknown as JobRecordDocument
      );

    return {
      job,
      gateway,
      musicRuntime,
      service,
      probe,
    };
  }

  it('suppresses fail and complete when provider interruption is intentional cancellation', async () => {
    const tempRoot =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          'harmonia-d5-error-'
        )
      );

    const cwdSpy =
      jest
        .spyOn(
          process,
          'cwd'
        )
        .mockReturnValue(
          tempRoot
        );

    try {
      const harness =
        makeHarness();

      const failSpy =
        jest.spyOn(
          harness.service,
          'fail'
        );

      const completeSpy =
        jest.spyOn(
          harness.service,
          'complete'
        );

      jest
        .spyOn(
          harness.probe,
          'runMusicGenClient'
        )
        .mockImplementation(
          async () => {
            harness.probe
              .activeGenerationCancellations
              .add(jobId);

            throw new Error(
              'docker exec interrupted by provider stop'
            );
          }
        );

      await harness.service
        .processGenerationJob(
          jobId,
          userId
        );

      expect(
        failSpy
      ).not.toHaveBeenCalled();

      expect(
        completeSpy
      ).not.toHaveBeenCalled();

      expect(
        harness.probe
          .activeGenerationCancellations
          .has(jobId)
      ).toBe(false);
    } finally {
      cwdSpy.mockRestore();

      await fs.rm(
        tempRoot,
        {
          recursive:
            true,
          force:
            true,
        }
      );
    }
  });

  it('does not validate or complete when provider returns during a cancellation race', async () => {
    const tempRoot =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          'harmonia-d5-return-'
        )
      );

    const cwdSpy =
      jest
        .spyOn(
          process,
          'cwd'
        )
        .mockReturnValue(
          tempRoot
        );

    try {
      const harness =
        makeHarness();

      const completeSpy =
        jest.spyOn(
          harness.service,
          'complete'
        );

      const validateSpy =
        jest
          .spyOn(
            harness.probe,
            'validateWav'
          )
          .mockRejectedValue(
            new Error(
              'validation must not run after cancellation'
            )
          );

      jest
        .spyOn(
          harness.probe,
          'runMusicGenClient'
        )
        .mockImplementation(
          async () => {
            harness.probe
              .activeGenerationCancellations
              .add(jobId);
          }
        );

      await harness.service
        .processGenerationJob(
          jobId,
          userId
        );

      expect(
        validateSpy
      ).not.toHaveBeenCalled();

      expect(
        completeSpy
      ).not.toHaveBeenCalled();

      expect(
        harness.probe
          .activeGenerationCancellations
          .has(jobId)
      ).toBe(false);
    } finally {
      cwdSpy.mockRestore();

      await fs.rm(
        tempRoot,
        {
          recursive:
            true,
          force:
            true,
        }
      );
    }
  });

  it('removes a stale WAV and persists queued retry state after a transient provider failure', async () => {
    const tempRoot =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          'harmonia-m18-retry-'
        )
      );

    const cwdSpy =
      jest
        .spyOn(
          process,
          'cwd'
        )
        .mockReturnValue(
          tempRoot
        );

    try {
      const harness =
        makeHarness();

      const hostDir =
        path.join(
          tempRoot,
          'exports',
          'jobs',
          jobId
        );

      const stalePath =
        path.join(
          hostDir,
          'music.wav'
        );

      await fs.mkdir(
        hostDir,
        {
          recursive: true,
        }
      );

      await fs.writeFile(
        stalePath,
        Buffer.from('stale-partial-audio')
      );

      jest
        .spyOn(
          harness.probe,
          'runMusicGenClient'
        )
        .mockImplementation(
          async () => {
            await expect(
              fs.stat(
                stalePath
              )
            ).rejects.toMatchObject({
              code: 'ENOENT',
            });

            throw new Error(
              'transient provider failure'
            );
          }
        );

      await expect(
        harness.service.processGenerationJob(
          jobId,
          userId,
          {
            attempt: 1,
            maxAttempts: 3,
          }
        )
      ).rejects.toThrow(
        'transient provider failure'
      );

      expect(
        harness.job.status
      ).toBe(
        'queued'
      );

      expect(
        harness.job.startedAt
      ).toBeNull();

      expect(
        harness.job.completedAt
      ).toBeNull();

      expect(
        harness.job.result
      ).toBeNull();

      expect(
        harness.job.generationAttempt
      ).toBe(1);

      expect(
        harness.job.generationMaxAttempts
      ).toBe(3);

      expect(
        harness.job.generationLastError
      ).toBe(
        'transient provider failure'
      );

      expect(
        harness.job.progress
      ).toEqual({
        current: 0,
        total: 100,
        percentage: 0,
        message:
          'Retrying generation attempt 2 of 3',
      });

      expect(
        harness.gateway.emitJobFailed
      ).not.toHaveBeenCalled();

      expect(
        harness.gateway.emitJobStatus
      ).toHaveBeenLastCalledWith(
        jobId,
        'queued'
      );

      expect(
        harness.musicRuntime.finishGeneration
      ).toHaveBeenCalledTimes(1);
    } finally {
      cwdSpy.mockRestore();

      await fs.rm(
        tempRoot,
        {
          recursive: true,
          force: true,
        }
      );
    }
  });

  it('persists terminal failure and rethrows when the final generation attempt is exhausted', async () => {
    const tempRoot =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          'harmonia-m18-exhausted-'
        )
      );

    const cwdSpy =
      jest
        .spyOn(
          process,
          'cwd'
        )
        .mockReturnValue(
          tempRoot
        );

    try {
      const harness =
        makeHarness();

      jest
        .spyOn(
          harness.probe,
          'runMusicGenClient'
        )
        .mockRejectedValue(
          new Error(
            'final provider failure'
          )
        );

      await expect(
        harness.service.processGenerationJob(
          jobId,
          userId,
          {
            attempt: 3,
            maxAttempts: 3,
          }
        )
      ).rejects.toThrow(
        'final provider failure'
      );

      expect(
        harness.job.status
      ).toBe(
        'failed'
      );

      expect(
        harness.job.result
      ).toEqual({
        error:
          'final provider failure',
      });

      expect(
        harness.job.completedAt
      ).toBeInstanceOf(
        Date
      );

      expect(
        harness.job.generationAttempt
      ).toBe(3);

      expect(
        harness.job.generationMaxAttempts
      ).toBe(3);

      expect(
        harness.job.generationLastError
      ).toBe(
        'final provider failure'
      );

      expect(
        harness.gateway.emitJobFailed
      ).toHaveBeenCalledWith(
        jobId,
        userId,
        'final provider failure'
      );

      expect(
        harness.musicRuntime.finishGeneration
      ).toHaveBeenCalledTimes(1);
    } finally {
      cwdSpy.mockRestore();

      await fs.rm(
        tempRoot,
        {
          recursive: true,
          force: true,
        }
      );
    }
  });

  it.each([
    'completed',
    'failed',
    'cancelled',
  ] as const)(
    'returns before provider work for terminal generation redelivery: %s',
    async (
      status
    ) => {
      const harness =
        makeHarness(
          status
        );

      await harness.service
        .processGenerationJob(
          jobId,
          userId
        );

      expect(
        harness.musicRuntime
          .selectModel
      ).not.toHaveBeenCalled();

      expect(
        harness.musicRuntime
          .beginGeneration
      ).not.toHaveBeenCalled();

      expect(
        harness.musicRuntime
          .finishGeneration
      ).not.toHaveBeenCalled();
    }
  );
});
