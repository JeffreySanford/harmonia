import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @IsIn(['generate', 'convert', 'analyze', 'train'])
  jobType: 'generate' | 'convert' | 'analyze' | 'train';

  @IsObject()
  parameters: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  datasetId?: string;
}

export class JobFiltersDto {
  @IsOptional()
  @IsIn(['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'])
  status?: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

  @IsOptional()
  @IsIn(['generate', 'convert', 'analyze', 'train'])
  type?: 'generate' | 'convert' | 'analyze' | 'train';
}
