import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateModelArtifactDto {
  @IsString()
  name!: string;

  @IsString()
  version!: string;

  @IsString()
  path!: string;

  @IsNumber()
  size_bytes!: number;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
