import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
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

interface WavMetadata {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  durationSeconds: number;
  size: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private generationTail: Promise<void> = Promise.resolve();

  constructor(
    @InjectModel(JobRecord.name)
    private readonly jobModel: Model<JobRecordDocument>,
    private readonly gateway: JobsGateway,
    private readonly musicRuntime: MusicRuntimeService
  ) {}

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
    });

    const result = this.toDto(job);
    this.gateway.emitJobStatusToUser(userId, result.id, result.status);

    if (dto.jobType === 'generate') {
      // Return the durable queued record before inference begins. The promise
      // chain serializes GPU generation while allowing the HTTP request to
      // complete immediately.
      setTimeout(() => this.enqueueGeneration(result.id, userId), 0);
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
      throw new BadRequestException(
        'Active generation cancellation is not implemented yet.'
      );
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
    this.gateway.emitJobCompleted(dto as unknown as Record<string, unknown>);
    return dto;
  }

  async fail(id: string, userId: string, error: string) {
    const job = await this.findOwnedDocument(id, userId);
    job.status = 'failed';
    job.result = { error };
    job.completedAt = new Date();
    await job.save();

    this.gateway.emitJobFailed(id, userId, error);
    return this.toDto(job);
  }

  private enqueueGeneration(jobId: string, userId: string): void {
    this.generationTail = this.generationTail
      .catch(() => undefined)
      .then(() => this.processGenerationJob(jobId, userId));
  }

  private async processGenerationJob(
    jobId: string,
    userId: string
  ): Promise<void> {
    const job = await this.findOwnedDocument(jobId, userId);

    if (job.status === 'cancelled') {
      return;
    }

    const model = job.modelId
      ? MUSIC_MODELS.find((candidate) => candidate.id === job.modelId)
      : null;

    if (!model) {
      await this.fail(jobId, userId, 'Generation job has no valid model.');
      return;
    }

    if (!['musicgen', 'diffsinger'].includes(model.providerId)) {
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
      });
      await this.updateProgress(jobId, userId, {
        current: 10,
        total: 100,
        percentage: 10,
        message: `Preparing ${model.name}`,
      });

      await this.musicRuntime.selectModel(model.id);

      await this.updateProgress(jobId, userId, {
        current: 20,
        total: 100,
        percentage: 20,
        message:
          model.providerId === 'diffsinger'
            ? 'Starting singing synthesis'
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
        if (model.providerId === 'musicgen') {
          const duration = Number(parameters['duration']);
          const prompt = this.buildGenerationPrompt(parameters);

          await this.runMusicGenClient({
            runtimeModelId: runtime.runtimeModelId,
            prompt,
            duration,
            outputPath: containerPath,
          });

          requestedDurationSeconds = duration;
          providerMetadata = {
            prompt,
            requestedDurationSeconds: duration,
          };
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

      await this.updateProgress(jobId, userId, {
        current: 90,
        total: 100,
        percentage: 90,
        message: 'Validating generated audio',
      });

      const wav = await this.validateWav(
        hostPath,
        requestedDurationSeconds
      );
      const downloadUrl = `/downloads/jobs/${jobId}/music.wav`;

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
      const message =
        error instanceof Error ? error.message : 'Unknown generation error';
      this.logger.error(`Generation job ${jobId} failed: ${message}`);
      await this.fail(jobId, userId, message).catch(() => undefined);
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

    if (model.providerId !== 'musicgen') {
      throw new BadRequestException(
        `${model.providerId} generation jobs are not implemented yet.`
      );
    }

    const duration = Number(dto.parameters?.['duration']);
    if (!Number.isFinite(duration) || duration < 1) {
      throw new BadRequestException(
        'Generation duration must be at least 1 second.'
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
