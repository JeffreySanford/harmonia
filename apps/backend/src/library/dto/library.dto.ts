import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateLibraryItemDto {
  @IsOptional()
  @IsString()
  songId?: string;

  @IsEnum(['song', 'music', 'audio', 'style'])
  type: 'song' | 'music' | 'audio' | 'style';

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsEnum(['wav', 'mp3', 'flac', 'json'])
  fileType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

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

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

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
  @IsNumber()
  page?: number;
}
