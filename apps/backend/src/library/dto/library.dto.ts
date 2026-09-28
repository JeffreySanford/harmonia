import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class UpdateLibraryItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: {
    genre?: string;
    mood?: string;
    bpm?: number;
    key?: string;
    instruments?: string[];
    model?: string;
    generationTime?: number;
  };
}

export class LibraryFiltersDto {
  @IsOptional()
  @IsEnum(['all', 'song', 'music', 'audio', 'style'])
  type?: 'all' | 'song' | 'music' | 'audio' | 'style';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['newest', 'oldest', 'title', 'mostPlayed'])
  sortBy?: 'newest' | 'oldest' | 'title' | 'mostPlayed';

  @IsOptional()
  @IsEnum(['true'])
  showDemo?: 'true';

  @IsOptional()
  @IsNumber()
  page?: number;
}
