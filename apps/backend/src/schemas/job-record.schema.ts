import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JobRecordDocument = JobRecord & Document;

export type JobRecordStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobRecordType = 'generate' | 'convert' | 'analyze' | 'train';

@Schema({ timestamps: true, collection: 'jobs' })
export class JobRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['generate', 'convert', 'analyze', 'train'],
    index: true,
  })
  jobType: JobRecordType;

  @Prop({
    required: true,
    enum: ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: JobRecordStatus;

  @Prop({ default: 0 })
  priority: number;

  @Prop({ index: true })
  modelId?: string;

  @Prop()
  datasetId?: string;

  @Prop({ type: Object, default: {} })
  parameters: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  progress: {
    current: number;
    total: number;
    percentage: number;
    message: string;
  } | null;

  @Prop({ type: Object, default: null })
  result: {
    outputPath?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  } | null;

  @Prop({ default: null })
  startedAt: Date | null;

  @Prop({ default: null })
  completedAt: Date | null;

  @Prop({ default: null })
  estimatedDuration: number | null;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const JobRecordSchema = SchemaFactory.createForClass(JobRecord);

JobRecordSchema.index({ userId: 1, createdAt: -1 });
JobRecordSchema.index({ userId: 1, status: 1, createdAt: -1 });
JobRecordSchema.index({ userId: 1, jobType: 1, createdAt: -1 });
