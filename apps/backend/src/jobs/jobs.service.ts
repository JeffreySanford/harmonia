import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JobsGateway } from '../app/gateways/jobs.gateway';
import {
  JobRecord,
  JobRecordDocument,
  JobRecordStatus,
} from '../schemas/job-record.schema';
import { CreateJobDto, JobFiltersDto } from './dto/jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(JobRecord.name)
    private readonly jobModel: Model<JobRecordDocument>,
    private readonly gateway: JobsGateway
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
