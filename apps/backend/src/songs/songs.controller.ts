import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateMetadataDto } from './dto/generate-metadata.dto';
import { OllamaService } from '../llm/ollama.service';

@Controller('songs')
export class SongsController {
  constructor(
    private readonly ollama: OllamaService,
    private readonly configService: ConfigService
  ) {}

  @Post('generate-metadata')
  @HttpCode(HttpStatus.OK)
  async generateMetadata(@Body() body: GenerateMetadataDto) {
    // Allow per-request override of model via `model` in the DTO
    const defaultModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'deepseek';
    const model = body.model || defaultModel;
    return this.ollama.generateMetadata(body.narrative, body.duration, model);
  }
}
