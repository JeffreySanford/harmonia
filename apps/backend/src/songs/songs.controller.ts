import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateMetadataDto } from './dto/generate-metadata.dto';
import { OllamaService } from '../llm/ollama.service';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService, StemExportOptions } from './stem-export.service';

@Controller('songs')
export class SongsController {
  constructor(
    private readonly ollama: OllamaService,
    private readonly configService: ConfigService,
    private readonly mmslParser: MmslParserService,
    private readonly stemExport: StemExportService
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

  @Post('suggest-genres')
  @HttpCode(HttpStatus.OK)
  async suggestGenres(@Body() body: { narrative: string; model?: string }) {
    const defaultModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'deepseek';
    const model = body.model || defaultModel;
    return this.ollama.suggestGenres(body.narrative, model);
  }

  @Post('parse-mmsl')
  @HttpCode(HttpStatus.OK)
  async parseMmsl(@Body() body: { mmsl: string }) {
    return this.mmslParser.parse(body.mmsl);
  }

  @Post('validate-mmsl')
  @HttpCode(HttpStatus.OK)
  async validateMmsl(@Body() body: { mmsl: string }) {
    return this.mmslParser.validate(body.mmsl);
  }

  @Post('export-stems')
  @HttpCode(HttpStatus.OK)
  async exportStems(@Body() body: StemExportOptions) {
    const validation = this.stemExport.validateOptions(body);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    return this.stemExport.exportStems(body);
  }
}
