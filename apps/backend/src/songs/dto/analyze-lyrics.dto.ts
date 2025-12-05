import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class AnalyzeLyricsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000) // Allow longer lyrics for analysis
  lyrics: string;

  @IsOptional()
  @IsBoolean()
  validateOnly?: boolean; // If true, only validate without full parsing

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(600) // 10 minutes max
  durationSeconds?: number; // Target song duration for attention span analysis

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
