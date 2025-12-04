import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  IsOptional,
} from 'class-validator';

export class GenerateMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  narrative: string;

  @IsInt()
  @Min(1)
  duration: number; // seconds

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;
}
