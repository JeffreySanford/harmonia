import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { JobOptions, Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { JobsGateway } from '../app/gateways/jobs.gateway';
import { MUSIC_MODELS } from '../music-runtime/music-model.catalog';
import { MusicRuntimeService } from '../music-runtime/music-runtime.service';
import {
  JobRecord,
  JobRecordDocument,
  JobRecordStatus,
} from '../schemas/job-record.schema';
import { CreateJobDto, JobFiltersDto } from './dto/jobs.dto';

const GENERATION_MAX_ATTEMPTS = 3;
const GENERATION_RETRY_BASE_DELAY_MS = 10_000;

export interface GenerationAttemptContext {
  attempt: number;
  maxAttempts: number;
}

interface WavMetadata {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  durationSeconds: number;
  size: number;
}

export interface ResolvedJobArtifact {
  filePath: string;
  filename: string;
  contentType: string;
  size: number;
}

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  private readonly activeGenerationCancellations =
    new Set<string>();

  constructor(
    @InjectModel(JobRecord.name)
    private readonly jobModel: Model<JobRecordDocument>,
    private readonly gateway: JobsGateway,
    private readonly musicRuntime: MusicRuntimeService,
    @InjectQueue('generation')
    private readonly generationQueue: Queue
  ) {}

  private generationQueueOptions(
    jobId: string
  ): JobOptions {
    return {
      jobId,
      attempts: GENERATION_MAX_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: GENERATION_RETRY_BASE_DELAY_MS,
      },
      removeOnComplete: false,
      removeOnFail: false,
    };
  }

  private async clearGenerationArtifact(
    jobId: string
  ): Promise<void> {
    const artifactPath =
      path.join(
        process.cwd(),
        'exports',
        'jobs',
        jobId,
        'music.wav'
      );

    await fs.rm(
      artifactPath,
      {
        force: true,
      }
    );
  }

  private async prepareGenerationRetry(
    jobId: string,
    userId: string,
    error: string,
    attemptContext: GenerationAttemptContext
  ): Promise<void> {
    const job =
      await this.findOwnedDocument(
        jobId,
        userId
      );

    job.status = 'queued';
    job.startedAt = null;
    job.completedAt = null;
    job.result = null;
    job.generationAttempt =
      attemptContext.attempt;
    job.generationMaxAttempts =
      attemptContext.maxAttempts;
    job.generationLastError =
      error;
    job.progress = {
      current: 0,
      total: 100,
      percentage: 0,
      message:
        `Retrying generation attempt ${
          attemptContext.attempt + 1
        } of ${
          attemptContext.maxAttempts
        }`,
    };

    await job.save();

    this.gateway.emitJobStatus(
      jobId,
      'queued'
    );

    this.gateway.emitJobStatusToUser(
      userId,
      jobId,
      'queued'
    );

    this.gateway.emitJobProgress(
      jobId,
      job.progress
    );
  }

  private consumeActiveGenerationCancellation(
    jobId: string
  ): boolean {
    if (
      !this.activeGenerationCancellations.has(
        jobId
      )
    ) {
      return false;
    }

    this.activeGenerationCancellations.delete(
      jobId
    );

    return true;
  }

  async onModuleInit(): Promise<void> {
    await this.generationQueue.isReady();
    await this.reconcileGenerationQueue();
  }

  private async reconcileGenerationQueue(): Promise<void> {
    const pendingJobs = await this.jobModel
      .find({
        jobType: 'generate',
        status: {
          $in: ['queued', 'processing'],
        },
      })
      .exec();

    for (const job of pendingJobs) {
      const jobId = job._id.toString();
      const userId = job.userId.toString();

      const existing =
        await this.generationQueue.getJob(jobId);

      if (existing) {
        continue;
      }

      if (
        await this.recoverCompletedGenerationArtifact(job)
      ) {
        continue;
      }

      if (job.status === 'processing') {
        job.status = 'queued';
        job.startedAt = null;
        job.progress = {
          current: 0,
          total: 100,
          percentage: 0,
          message: 'Recovered after backend restart; queued for durable replay',
        };

        await job.save();
      }

      await this.generationQueue.add(
        'generate',
        {
          jobId,
          userId,
        },
        this.generationQueueOptions(jobId)
      );

      this.logger.warn(
        `Recovered generation job ${jobId} after backend restart`
      );
    }
  }

  private async recoverCompletedGenerationArtifact(
    job: JobRecordDocument
  ): Promise<boolean> {
    const jobId =
      job._id.toString();

    const model =
      job.modelId
        ? MUSIC_MODELS.find(
            (candidate) =>
              candidate.id === job.modelId
          )
        : null;

    if (!model) {
      return false;
    }

    const parameters =
      job.parameters || {};

    let requestedDurationSeconds: number;

    try {
      if (
        model.providerId === 'diffsinger'
      ) {
        requestedDurationSeconds =
          this.parseDiffSingerScore(
            parameters
          ).expectedDurationSeconds;
      } else {
        requestedDurationSeconds =
          Number(
            parameters['duration']
          );
      }
    } catch {
      return false;
    }

    if (
      !Number.isFinite(
        requestedDurationSeconds
      ) ||
      requestedDurationSeconds <= 0
    ) {
      return false;
    }

    const hostPath =
      path.join(
        process.cwd(),
        'exports',
        'jobs',
        jobId,
        'music.wav'
      );

    let wav: WavMetadata;

    try {
      wav =
        await this.validateWav(
          hostPath,
          requestedDurationSeconds
        );
    } catch {
      return false;
    }

    const title =
      String(
        parameters['title'] ||
          'generated-music'
      );

    const downloadUrl =
      `/api/jobs/${jobId}/artifact`;

    job.status =
      'completed';

    job.completedAt =
      new Date();

    job.progress = {
      current: 100,
      total: 100,
      percentage: 100,
      message: 'Completed',
    };

    job.result = {
      outputPath: downloadUrl,
      metadata: {
        title,
        providerId:
          model.providerId,
        modelId:
          model.id,
        recoveredAfterRestart:
          true,
        requestedDurationSeconds,
        actualDurationSeconds:
          wav.durationSeconds,
        channels:
          wav.channels,
        sampleRate:
          wav.sampleRate,
        bitsPerSample:
          wav.bitsPerSample,
        size:
          wav.size,
        downloadUrl,
      },
    };

    await job.save();

    const dto =
      this.toDto(job);

    // onModuleInit can run before the WebSocket server has
    // been attached to the gateway. Persisted recovery must
    // never depend on socket readiness.
    if (this.gateway.server) {
      this.gateway.emitJobCompleted(
        dto
      );
    }

    this.logger.log(
      `Recovered completed generation artifact ${jobId} after backend restart`
    );

    return true;
  }

  async findAll(userId: string, filters: JobFiltersDto) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (filters.status) {
      query['status'] = filters.status;
    }
    if (filters.type) {
      query['jobType'] = filters.type;
    }

    const jobs = await this.jobModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return jobs.map((job) => this.toDto(job));
  }

  async findOne(id: string, userId: string) {
    const job = await this.findOwnedDocument(id, userId);
    return this.toDto(job);
  }

  async create(dto: CreateJobDto, userId: string) {
    if (dto.jobType === 'generate') {
      this.validateGenerationRequest(dto);
    }

    const job = await this.jobModel.create({
      userId: new Types.ObjectId(userId),
      jobType: dto.jobType,
      status: 'queued',
      priority: dto.priority ?? 0,
      modelId: dto.modelId,
      datasetId: dto.datasetId,
      parameters: dto.parameters,
      progress: {
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Queued',
      },
      result: null,
      startedAt: null,
      completedAt: null,
      estimatedDuration: null,
      generationAttempt:
        dto.jobType === 'generate'
          ? 0
          : undefined,
      generationMaxAttempts:
        dto.jobType === 'generate'
          ? GENERATION_MAX_ATTEMPTS
          : null,
      generationLastError: null,
    });

    const result = this.toDto(job);
    this.gateway.emitJobStatusToUser(userId, result.id, result.status);

    if (dto.jobType === 'generate') {
      // Mongo owns the durable application record; Bull owns durable
      // dispatch. Reusing the Mongo id as the Bull job id gives the two
      // persistence layers one stable generation identity.
      await this.generationQueue.add(
        'generate',
        {
          jobId: result.id,
          userId,
        },
        this.generationQueueOptions(result.id)
      );
    }

    return result;
  }

  async cancel(id: string, userId: string) {
    const job = await this.findOwnedDocument(id, userId);

    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new BadRequestException(
        `Job ${id} is already ${job.status} and cannot be cancelled.`
      );
    }

    if (job.status === 'processing') {
      if (job.jobType !== 'generate') {
        throw new BadRequestException(
          'Only active generation jobs can be cancelled.'
        );
      }

      const model =
        job.modelId
          ? MUSIC_MODELS.find(
              (candidate) =>
                candidate.id === job.modelId
            )
          : null;

      if (!model) {
        throw new BadRequestException(
          'Processing generation job has no valid model.'
        );
      }

      this.activeGenerationCancellations.add(
        id
      );

      try {
        await this.musicRuntime.cancelGeneration(
          model.providerId
        );
      } catch (error) {
        this.activeGenerationCancellations.delete(
          id
        );

        throw error;
      }
    }

    if (
      job.jobType === 'generate' &&
      job.status === 'queued'
    ) {
      const queuedGeneration =
        await this.generationQueue.getJob(id);

      if (queuedGeneration) {
        await queuedGeneration.remove();
      }
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.progress = {
      current: 0,
      total: 100,
      percentage: 0,
      message: 'Cancelled',
    };
    await job.save();

    const result = this.toDto(job);
    this.gateway.emitJobStatus(id, result.status);
    this.gateway.emitJobStatusToUser(userId, id, result.status);
    return result;
  }

  async remove(id: string, userId: string): Promise<void> {
    const job = await this.findOwnedDocument(id, userId);

    if (job.status === 'processing') {
      throw new BadRequestException('A processing job cannot be deleted.');
    }

    await this.jobModel.deleteOne({ _id: job._id }).exec();
  }

  async resolveOwnedArtifact(
    id: string,
    userId: string
  ): Promise<ResolvedJobArtifact> {
    const job = await this.findOwnedDocument(
      id,
      userId
    );

    if (job.status !== 'completed') {
      throw new NotFoundException(
        'Job artifact not found'
      );
    }

    const rootPath = path.resolve(
      process.cwd(),
      'exports',
      'jobs'
    );

    const jobRoot = path.resolve(
      rootPath,
      job._id.toString()
    );

    const filePath = path.resolve(
      jobRoot,
      'music.wav'
    );

    if (
      !jobRoot.startsWith(
        `${rootPath}${path.sep}`
      ) ||
      !filePath.startsWith(
        `${jobRoot}${path.sep}`
      )
    ) {
      throw new NotFoundException(
        'Job artifact not found'
      );
    }

    let stat;

    try {
      stat = await fs.stat(filePath);
    } catch {
      throw new NotFoundException(
        'Job artifact not found'
      );
    }

    if (!stat.isFile()) {
      throw new NotFoundException(
        'Job artifact not found'
      );
    }

    return {
      filePath,
      filename: 'music.wav',
      contentType: 'audio/wav',
      size: stat.size,
    };
  }

  async updateStatus(
    id: string,
    userId: string,
    status: JobRecordStatus,
    updates: Partial<JobRecord> = {}
  ) {
    const job = await this.findOwnedDocument(id, userId);
    job.status = status;
    Object.assign(job, updates);
    await job.save();

    const result = this.toDto(job);
    this.gateway.emitJobStatus(id, result.status);
    this.gateway.emitJobStatusToUser(userId, id, result.status);
    return result;
  }

  async updateProgress(
    id: string,
    userId: string,
    progress: {
      current: number;
      total: number;
      percentage: number;
      message: string;
    }
  ) {
    const job = await this.findOwnedDocument(id, userId);
    job.progress = progress;
    await job.save();
    this.gateway.emitJobProgress(id, progress);
    return this.toDto(job);
  }

  async complete(
    id: string,
    userId: string,
    result: {
      outputPath?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const job = await this.findOwnedDocument(id, userId);
    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date();
    job.progress = {
      current: 100,
      total: 100,
      percentage: 100,
      message: 'Completed',
    };
    await job.save();

    const dto = this.toDto(job);
    this.gateway.emitJobCompleted(dto);
    return dto;
  }

  async fail(id: string, userId: string, error: string) {
    const job = await this.findOwnedDocument(id, userId);
    job.status = 'failed';
    job.result = { error };
    job.completedAt = new Date();

    if (job.jobType === 'generate') {
      job.generationLastError =
        error;
    }

    await job.save();

    this.gateway.emitJobFailed(id, userId, error);
    return this.toDto(job);
  }

  async processGenerationJob(
    jobId: string,
    userId: string,
    attemptContext: GenerationAttemptContext = {
      attempt: 1,
      maxAttempts: GENERATION_MAX_ATTEMPTS,
    }
  ): Promise<void> {
    const job = await this.findOwnedDocument(jobId, userId);

    if (
      ['completed', 'failed', 'cancelled'].includes(
        job.status
      )
    ) {
      return;
    }

    const model = job.modelId
      ? MUSIC_MODELS.find((candidate) => candidate.id === job.modelId)
      : null;

    if (!model) {
      await this.fail(jobId, userId, 'Generation job has no valid model.');
      return;
    }

    if (
      ![
        'musicgen',
        'diffsinger',
        'stable-audio-3',
        'ace-step-1.5',
        'diffrhythm',
      ].includes(model.providerId)
    ) {
      await this.fail(
        jobId,
        userId,
        `${model.providerId} generation jobs are not implemented yet.`
      );
      return;
    }

    const parameters = job.parameters || {};
    const title = String(parameters['title'] || 'generated-music');

    try {
      await this.updateStatus(jobId, userId, 'processing', {
        startedAt: new Date(),
        generationAttempt: attemptContext.attempt,
        generationMaxAttempts: attemptContext.maxAttempts,
        generationLastError: null,
      });
      await this.updateProgress(jobId, userId, {
        current: 10,
        total: 100,
        percentage: 10,
        message: `Preparing ${model.name}`,
      });

      await this.clearGenerationArtifact(
        jobId
      );

      await this.musicRuntime.selectModel(model.id);

      await this.updateProgress(jobId, userId, {
        current: 20,
        total: 100,
        percentage: 20,
        message:
          model.providerId === 'diffsinger'
            ? 'Starting singing synthesis'
            : model.providerId === 'stable-audio-3'
              ? 'Starting Stable Audio generation'
              : model.providerId === 'ace-step-1.5'
                ? 'Starting ACE-Step full-song generation'
                : model.providerId === 'diffrhythm'
                  ? 'Starting DiffRhythm lyric-conditioned generation'
                  : 'Starting music generation',
      });

      const runtime = await this.musicRuntime.beginGeneration(model.providerId);
      const hostDir = path.join(process.cwd(), 'exports', 'jobs', jobId);
      const hostPath = path.join(hostDir, 'music.wav');
      const containerPath = `/workspace/exports/jobs/${jobId}/music.wav`;

      await fs.mkdir(hostDir, { recursive: true });

      let requestedDurationSeconds: number;
      let providerMetadata: Record<string, unknown>;

      try {
        if (
          model.providerId === 'musicgen' ||
          model.providerId === 'stable-audio-3' ||
          model.providerId === 'ace-step-1.5' ||
          model.providerId === 'diffrhythm'
        ) {
          const duration = Number(parameters['duration']);
          const prompt = this.buildGenerationPrompt(parameters);

          if (model.providerId === 'musicgen') {
            await this.runMusicGenClient({
              runtimeModelId: runtime.runtimeModelId,
              prompt,
              duration,
              outputPath: containerPath,
            });

            providerMetadata = {
              prompt,
              requestedDurationSeconds: duration,
            };
          } else if (model.providerId === 'stable-audio-3') {
            await this.runStableAudio3Client({
              runtimeModelId: runtime.runtimeModelId,
              prompt,
              duration,
              outputPath: containerPath,
            });

            providerMetadata = {
              prompt,
              requestedDurationSeconds: duration,
            };
          } else if (model.providerId === 'diffrhythm') {
            const lyrics = String(
              parameters['lyrics'] || ''
            ).trim();

            const seedValue =
              parameters['seed'];

            const seed =
              seedValue === undefined ||
              seedValue === null ||
              seedValue === ''
                ? undefined
                : Number(seedValue);

            const diffRhythm =
              await this.runDiffRhythmClient({
                runtimeModelId:
                  runtime.runtimeModelId,
                prompt,
                lyrics,
                duration,
                seed:
                  Number.isFinite(seed) &&
                  seed !== undefined &&
                  seed >= 0
                    ? Math.round(seed)
                    : undefined,
                outputPath:
                  containerPath,
              });

            providerMetadata = {
              prompt,
              lyrics,
              requestedDurationSeconds:
                duration,
              ...(seed !== undefined
                ? {
                    seed:
                      Math.round(seed),
                  }
                : {}),
              diffRhythm,
            };
          } else {
            const lyrics = String(
              parameters['lyrics'] || ''
            ).trim();
            const bpm = Number(parameters['bpm']);
            const seed = Number(parameters['seed']);

            const ace = await this.runAceStepClient({
              runtimeModelId: runtime.runtimeModelId,
              prompt,
              lyrics,
              duration,
              bpm:
                Number.isFinite(bpm) && bpm > 0
                  ? Math.round(bpm)
                  : undefined,
              seed:
                Number.isFinite(seed) && seed >= 0
                  ? Math.round(seed)
                  : undefined,
              vocalLanguage: String(
                parameters['vocalLanguage'] ||
                  parameters['vocal_language'] ||
                  'en'
              ),
              outputPath: containerPath,
            });

            providerMetadata = {
              prompt,
              lyrics,
              requestedDurationSeconds: duration,
              aceStep: ace,
            };
          }

          requestedDurationSeconds = duration;
        } else {
          const score = this.parseDiffSingerScore(parameters);
          const hostRequestPath = path.join(hostDir, 'request.json');
          const containerRequestPath =
            `/workspace/exports/jobs/${jobId}/request.json`;

          await fs.writeFile(
            hostRequestPath,
            JSON.stringify(
              {
                title,
                text: score.text,
                notes: score.notes,
                notes_duration: score.notesDuration,
                input_type: score.inputType,
              },
              null,
              2
            ),
            'utf8'
          );

          await this.runDiffSingerClient({
            metadataPath: containerRequestPath,
            outputPath: containerPath,
          });

          requestedDurationSeconds = score.expectedDurationSeconds;
          providerMetadata = {
            text: score.text,
            notes: score.notes,
            notesDuration: score.notesDuration,
            inputType: score.inputType,
            requestedDurationSeconds: score.expectedDurationSeconds,
          };
        }
      } finally {
        await this.musicRuntime.finishGeneration(model.providerId);
      }

      if (
        this.consumeActiveGenerationCancellation(jobId)
      ) {
        this.logger.log(
          'Generation cancellation consumed after provider execution.'
        );

        return;
      }

      await this.updateProgress(jobId, userId, {
        current: 90,
        total: 100,
        percentage: 90,
        message: 'Validating generated audio',
      });

      if (
        this.consumeActiveGenerationCancellation(jobId)
      ) {
        this.logger.log(
          'Generation cancellation consumed before WAV validation.'
        );

        return;
      }

      const wav = await this.validateWav(
        hostPath,
        requestedDurationSeconds
      );
      const downloadUrl = `/api/jobs/${jobId}/artifact`;

      if (
        this.consumeActiveGenerationCancellation(jobId)
      ) {
        this.logger.log(
          'Generation cancellation consumed before completion.'
        );

        return;
      }

      await this.complete(jobId, userId, {
        outputPath: downloadUrl,
        metadata: {
          title,
          providerId: model.providerId,
          modelId: model.id,
          runtimeModelId: runtime.runtimeModelId,
          ...providerMetadata,
          actualDurationSeconds: wav.durationSeconds,
          channels: wav.channels,
          sampleRate: wav.sampleRate,
          bitsPerSample: wav.bitsPerSample,
          size: wav.size,
          downloadUrl,
        },
      });
    } catch (error) {
      if (
        this.consumeActiveGenerationCancellation(jobId)
      ) {
        this.logger.log(
          'Generation provider interruption consumed as cancellation.'
        );

        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown generation error';

      if (
        attemptContext.attempt < attemptContext.maxAttempts
      ) {
        this.logger.warn(
          `Generation job ${jobId} attempt ${
            attemptContext.attempt
          } of ${
            attemptContext.maxAttempts
          } failed and will retry: ${message}`
        );

        await this.prepareGenerationRetry(
          jobId,
          userId,
          message,
          attemptContext
        );

        throw error;
      }

      this.logger.error(
        `Generation job ${jobId} exhausted ${
          attemptContext.maxAttempts
        } attempts: ${message}`
      );

      await this.fail(
        jobId,
        userId,
        message
      );

      throw error;
    }
  }

  private validateGenerationRequest(dto: CreateJobDto): void {
    if (!dto.modelId) {
      throw new BadRequestException('A modelId is required for generation.');
    }

    const model = MUSIC_MODELS.find((candidate) => candidate.id === dto.modelId);
    if (!model) {
      throw new BadRequestException(`Unknown music model: ${dto.modelId}`);
    }

    if (model.providerId === 'diffsinger') {
      this.parseDiffSingerScore(dto.parameters || {});
      return;
    }

    if (
      model.providerId !== 'musicgen' &&
      model.providerId !== 'stable-audio-3' &&
      model.providerId !== 'ace-step-1.5' &&
      model.providerId !== 'diffrhythm'
    ) {
      throw new BadRequestException(
        `${model.providerId} generation jobs are not implemented yet.`
      );
    }

    const duration = Number(dto.parameters?.['duration']);
    const minimumDuration =
      model.providerId === 'ace-step-1.5'
        ? 10
        : 1;

    if (
      model.providerId === 'diffrhythm' &&
      duration !== 95
    ) {
      throw new BadRequestException(
        'DiffRhythm v1.2 Base generation requires exactly 95 seconds.'
      );
    }

    if (
      !Number.isFinite(duration) ||
      duration < minimumDuration
    ) {
      throw new BadRequestException(
        `Generation duration must be at least ${minimumDuration} second${
          minimumDuration === 1 ? '' : 's'
        }.`
      );
    }

    if (
      model.maxDurationSeconds &&
      duration > model.maxDurationSeconds
    ) {
      throw new BadRequestException(
        `${model.name} supports at most ${model.maxDurationSeconds} seconds.`
      );
    }

    const prompt = this.buildGenerationPrompt(dto.parameters || {});
    if (!prompt) {
      throw new BadRequestException(
        'Generation requires a prompt or descriptive music parameters.'
      );
    }

    if (
      model.providerId === 'ace-step-1.5' ||
      model.providerId === 'diffrhythm'
    ) {
      const lyrics = String(
        dto.parameters?.['lyrics'] || ''
      ).trim();

      if (!lyrics) {
        throw new BadRequestException(
          model.providerId === 'diffrhythm'
            ? 'DiffRhythm generation requires supplied lyrics.'
            : 'ACE-Step generation requires supplied lyrics.'
        );
      }
    }

    if (
      model.providerId === 'diffrhythm' &&
      dto.parameters?.['seed'] !== undefined &&
      dto.parameters?.['seed'] !== null &&
      dto.parameters?.['seed'] !== ''
    ) {
      const seed = Number(
        dto.parameters?.['seed']
      );

      if (
        !Number.isFinite(seed) ||
        seed < 0 ||
        !Number.isInteger(seed)
      ) {
        throw new BadRequestException(
          'DiffRhythm seed must be a non-negative integer.'
        );
      }
    }
  }

  private parseDiffSingerScore(parameters: Record<string, unknown>): {
    text: string;
    notes: string;
    notesDuration: string;
    inputType: 'word';
    expectedDurationSeconds: number;
  } {
    const text = String(
      parameters['text'] || parameters['lyrics'] || ''
    ).trim();
    const notes = String(parameters['notes'] || '').trim();
    const notesDuration = String(
      parameters['notesDuration'] || parameters['notes_duration'] || ''
    ).trim();
    const inputType = String(
      parameters['inputType'] || parameters['input_type'] || 'word'
    ).trim();

    if (!text || !notes || !notesDuration) {
      throw new BadRequestException(
        'DiffSinger generation requires text/lyrics, notes, and notesDuration.'
      );
    }

    if (inputType !== 'word') {
      throw new BadRequestException(
        'The pinned DiffSinger OpenCpop runtime currently supports word-level score input only.'
      );
    }

    const noteGroups = notes
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
    const durationGroups = notesDuration
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      noteGroups.length === 0 ||
      noteGroups.length !== durationGroups.length
    ) {
      throw new BadRequestException(
        'DiffSinger notes and notesDuration must contain the same number of pipe-separated word groups.'
      );
    }

    const durations = notesDuration
      .split(/[|\s]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map(Number);

    if (
      durations.length === 0 ||
      durations.some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      throw new BadRequestException(
        'DiffSinger notesDuration must contain only positive numeric durations.'
      );
    }

    const expectedDurationSeconds = durations.reduce(
      (sum, value) => sum + value,
      0
    );

    return {
      text,
      notes,
      notesDuration,
      inputType: 'word',
      expectedDurationSeconds,
    };
  }

  private buildGenerationPrompt(
    parameters: Record<string, unknown>
  ): string {
    const explicit = String(parameters['prompt'] || '').trim();
    if (explicit) {
      return explicit.slice(0, 2000);
    }

    const parts: string[] = [];
    const genre = String(parameters['genre'] || '').trim();
    const mood = String(parameters['mood'] || '').trim();
    const bpm = Number(parameters['bpm']);
    const instruments = Array.isArray(parameters['instruments'])
      ? parameters['instruments']
          .map((value) => String(value).replace(/[-_]/g, ' ').trim())
          .filter(Boolean)
      : [];

    if (genre) {
      parts.push(`${genre} music`);
    }
    if (mood) {
      parts.push(`${mood} mood`);
    }
    if (Number.isFinite(bpm) && bpm > 0) {
      parts.push(`${Math.round(bpm)} BPM`);
    }
    if (instruments.length > 0) {
      parts.push(`featuring ${instruments.join(', ')}`);
    }

    return parts.join(', ').slice(0, 2000);
  }

  private runMusicGenClient(options: {
    runtimeModelId: string;
    prompt: string;
    duration: number;
    outputPath: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'docker',
        [
          'exec',
          'harmonia-musicgen',
          'python3.9',
          '/workspace/scripts/musicgen_provider_client.py',
          '--instrument',
          'full_mix',
          '--output',
          options.outputPath,
          '--duration',
          String(Math.round(options.duration)),
          '--model',
          options.runtimeModelId,
          '--prompt',
          options.prompt,
        ],
        {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `MusicGen provider exited with code ${code ?? 'unknown'}: ${(
              stderr ||
              stdout ||
              'no provider output'
            )
              .trim()
              .slice(-2000)}`
          )
        );
      });
    });
  }

  private runStableAudio3Client(options: {
    runtimeModelId: string;
    prompt: string;
    duration: number;
    outputPath: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'docker',
        [
          'exec',
          'harmonia-stable-audio-3',
          'python',
          '/workspace/scripts/stable_audio_3_provider_client.py',
          '--output',
          options.outputPath,
          '--duration',
          String(options.duration),
          '--model',
          options.runtimeModelId,
          '--prompt',
          options.prompt,
        ],
        {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `Stable Audio 3 provider exited with code ${code ?? 'unknown'}: ${(
              stderr ||
              stdout ||
              'no provider output'
            )
              .trim()
              .slice(-3000)}`
          )
        );
      });
    });
  }

  private runAceStepClient(options: {
    runtimeModelId: string;
    prompt: string;
    lyrics: string;
    duration: number;
    bpm?: number;
    seed?: number;
    vocalLanguage: string;
    outputPath: string;
  }): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const args = [
        'exec',
        'harmonia-ace-step-1.5',
        '/opt/ACE-Step-1.5/.venv/bin/python',
        '/workspace/scripts/ace_step_provider_client.py',
        '--output',
        options.outputPath,
        '--duration',
        String(options.duration),
        '--model',
        options.runtimeModelId,
        '--prompt',
        options.prompt,
        '--lyrics',
        options.lyrics,
        '--vocal-language',
        options.vocalLanguage || 'en',
      ];

      if (options.bpm !== undefined) {
        args.push(
          '--bpm',
          String(options.bpm)
        );
      }

      if (options.seed !== undefined) {
        args.push(
          '--seed',
          String(options.seed)
        );
      }

      const child = spawn(
        'docker',
        args,
        {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.once('error', reject);

      child.once('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `ACE-Step provider exited with code ${code ?? 'unknown'}: ${
                (
                  stderr ||
                  stdout ||
                  'no provider output'
                )
                  .trim()
                  .slice(-5000)
              }`
            )
          );
          return;
        }

        const lines = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length === 0) {
          reject(
            new Error(
              'ACE-Step provider returned no machine-readable result.'
            )
          );
          return;
        }

        const resultLine =
          lines[
            lines.length - 1
          ];

        if (!resultLine) {
          reject(
            new Error(
              'ACE-Step provider returned no final JSON result.'
            )
          );
          return;
        }

        try {
          resolve(
            JSON.parse(
              resultLine
            ) as Record<string, unknown>
          );
        } catch {
          reject(
            new Error(
              `ACE-Step provider returned invalid JSON: ${stdout
                .trim()
                .slice(-3000)}`
            )
          );
        }
      });
    });
  }

  private runDiffRhythmClient(options: {
    runtimeModelId: string;
    prompt: string;
    lyrics: string;
    duration: number;
    seed?: number;
    outputPath: string;
  }): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const args = [
        'exec',
        'harmonia-diffrhythm',
        'python',
        '/workspace/scripts/diffrhythm_provider_client.py',
        '--output',
        options.outputPath,
        '--duration',
        String(options.duration),
        '--model',
        options.runtimeModelId,
        '--prompt',
        options.prompt,
        '--lyrics',
        options.lyrics,
      ];

      if (options.seed !== undefined) {
        args.push(
          '--seed',
          String(options.seed)
        );
      }

      const child = spawn(
        'docker',
        args,
        {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on(
        'data',
        (chunk: Buffer) => {
          stdout += chunk.toString();
        }
      );

      child.stderr.on(
        'data',
        (chunk: Buffer) => {
          stderr += chunk.toString();
        }
      );

      child.once(
        'error',
        reject
      );

      child.once(
        'close',
        (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `DiffRhythm provider exited with code ${
                  code ?? 'unknown'
                }: ${
                  (
                    stderr ||
                    stdout ||
                    'no provider output'
                  )
                    .trim()
                    .slice(-5000)
                }`
              )
            );

            return;
          }

          const lines =
            stdout
              .split(/\r?\n/)
              .map(
                (line) =>
                  line.trim()
              )
              .filter(Boolean);

          const resultLine =
            lines[
              lines.length - 1
            ];

          if (!resultLine) {
            reject(
              new Error(
                'DiffRhythm provider returned no machine-readable result.'
              )
            );

            return;
          }

          try {
            resolve(
              JSON.parse(
                resultLine
              ) as Record<string, unknown>
            );

          } catch {
            reject(
              new Error(
                `DiffRhythm provider returned invalid JSON: ${
                  stdout
                    .trim()
                    .slice(-3000)
                }`
              )
            );
          }
        }
      );
    });
  }

  private runDiffSingerClient(options: {
    metadataPath: string;
    outputPath: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'docker',
        [
          'exec',
          'harmonia-diffsinger',
          'python3',
          '/workspace/scripts/run_diffsinger.py',
          options.metadataPath,
          options.outputPath,
        ],
        {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `DiffSinger provider exited with code ${code ?? 'unknown'}: ${(
              stderr ||
              stdout ||
              'no provider output'
            )
              .trim()
              .slice(-3000)}`
          )
        );
      });
    });
  }

  private async validateWav(
    filePath: string,
    requestedDurationSeconds: number
  ): Promise<WavMetadata> {
    const file = await fs.readFile(filePath);
    if (file.length < 44) {
      throw new Error('Generated audio is too small to be a valid WAV file.');
    }
    if (
      file.toString('ascii', 0, 4) !== 'RIFF' ||
      file.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      throw new Error('Generated artifact is not a RIFF/WAVE audio file.');
    }

    let offset = 12;
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let byteRate = 0;
    let dataBytes = 0;

    while (offset + 8 <= file.length) {
      const chunkId = file.toString('ascii', offset, offset + 4);
      const chunkSize = file.readUInt32LE(offset + 4);
      const dataStart = offset + 8;

      if (dataStart + chunkSize > file.length) {
        throw new Error('Generated WAV contains a truncated chunk.');
      }

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        const audioFormat = file.readUInt16LE(dataStart);
        if (audioFormat !== 1 && audioFormat !== 3) {
          throw new Error(
            `Generated WAV uses unsupported audio format ${audioFormat}.`
          );
        }
        channels = file.readUInt16LE(dataStart + 2);
        sampleRate = file.readUInt32LE(dataStart + 4);
        byteRate = file.readUInt32LE(dataStart + 8);
        bitsPerSample = file.readUInt16LE(dataStart + 14);
      } else if (chunkId === 'data') {
        dataBytes = chunkSize;
      }

      offset = dataStart + chunkSize + (chunkSize % 2);
    }

    if (
      channels < 1 ||
      sampleRate < 8000 ||
      bitsPerSample < 8 ||
      byteRate < 1 ||
      dataBytes < 1
    ) {
      throw new Error('Generated WAV is missing valid audio metadata.');
    }

    const durationSeconds = dataBytes / byteRate;
    const minimumDuration = Math.max(0.5, requestedDurationSeconds * 0.9);

    if (durationSeconds < minimumDuration) {
      throw new Error(
        `Generated WAV duration ${durationSeconds.toFixed(
          2
        )}s is shorter than the requested ${requestedDurationSeconds}s.`
      );
    }

    return {
      channels,
      sampleRate,
      bitsPerSample,
      durationSeconds,
      size: file.length,
    };
  }

  private async findOwnedDocument(
    id: string,
    userId: string
  ): Promise<JobRecordDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Job not found');
    }

    const job = await this.jobModel
      .findOne({
        _id: id,
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private toDto(job: JobRecordDocument) {
    return {
      id: job._id.toString(),
      jobType: job.jobType,
      status: job.status,
      priority: job.priority,
      userId: job.userId.toString(),
      modelId: job.modelId,
      datasetId: job.datasetId,
      parameters: job.parameters || {},
      progress: job.progress || null,
      result: job.result || null,
      createdAt: job.createdAt?.toISOString?.() || String(job.createdAt),
      startedAt: job.startedAt?.toISOString?.() || null,
      completedAt: job.completedAt?.toISOString?.() || null,
      estimatedDuration: job.estimatedDuration ?? null,
    };
  }
}
