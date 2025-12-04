import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsBoolean,
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
  @IsString()
  @MaxLength(100)
  model?: string;
}
