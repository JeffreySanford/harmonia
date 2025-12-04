import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GenerateMetadataDto } from './dto/generate-metadata.dto';
import { OllamaService } from '../llm/ollama.service';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService, StemExportOptions } from './stem-export.service';

@Controller('songs')
@ApiTags('songs')
export class SongsController {
  constructor(
    private readonly ollama: OllamaService,
    private readonly configService: ConfigService,
    private readonly mmslParser: MmslParserService,
    private readonly stemExport: StemExportService
  ) {}

  @Post('generate-metadata')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Generate song metadata from narrative using AI' })
  @ApiResponse({
    status: 200,
    description: 'Song metadata successfully generated',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Discovering Passion' },
        lyrics: {
          type: 'string',
          example: '[Verse 1]\nIn the quiet of the night...',
        },
        genre: { type: 'string', example: 'folk' },
        mood: {
          type: 'array',
          items: { type: 'string' },
          example: ['melancholic', 'hopeful'],
        },
        syllableCount: { type: 'number', example: 245 },
        wordCount: { type: 'number', example: 180 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid narrative or parameters' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid authentication',
  })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  async generateMetadata(@Body() body: GenerateMetadataDto) {
    // Allow per-request override of model via `model` in the DTO
    const defaultModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'deepseek';
    const model = body.model || defaultModel;
    return this.ollama.generateMetadata(body.narrative, body.duration, model);
  }

  @Post('generate-song')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Generate complete song with lyrics, melody, and instrumentation' })
  @ApiResponse({
    status: 200,
    description: 'Complete song successfully generated',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Discovering Passion' },
        lyrics: {
          type: 'string',
          example: '[Verse 1]\nIn the quiet of the night...',
        },
        genre: { type: 'string', example: 'folk' },
        mood: { type: 'string', example: 'melancholic' },
        melody: { type: 'string', example: 'Upbeat acoustic guitar melody with vocal harmonies' },
        tempo: { type: 'number', example: 120 },
        key: { type: 'string', example: 'G major' },
        instrumentation: {
          type: 'array',
          items: { type: 'string' },
          example: ['acoustic guitar', 'piano', 'drums'],
        },
        intro: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            style: { type: 'string', enum: ['with-music', 'sung', 'no-music'], example: 'with-music' },
            content: { type: 'string', example: 'Soft guitar intro' },
          },
        },
        outro: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: false },
            style: { type: 'string', enum: ['with-music', 'sung', 'no-music'], example: 'no-music' },
            content: { type: 'string', example: null },
          },
        },
        syllableCount: { type: 'number', example: 245 },
        wordCount: { type: 'number', example: 180 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid narrative or parameters' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid authentication',
  })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  async generateSong(@Body() body: GenerateMetadataDto) {
    // Allow per-request override of model via `model` in the DTO
    const defaultModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'deepseek';
    const model = body.model || defaultModel;
    return this.ollama.generateSong(body.narrative, body.duration, model);
  }

  @Post('suggest-genres')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Suggest musical genres based on narrative' })
  @ApiResponse({
    status: 200,
    description: 'Genres successfully suggested',
    schema: {
      type: 'object',
      properties: {
        genres: {
          type: 'array',
          items: { type: 'string' },
          example: ['electronic', 'rock', 'hip-hop'],
        },
        confidence: {
          type: 'array',
          items: { type: 'number' },
          example: [0.85, 0.72, 0.68],
        },
      },
    },
  })
  async suggestGenres(@Body() body: { narrative: string; model?: string }) {
    const defaultModel =
      this.configService.get<string>('OLLAMA_MODEL') || 'deepseek';
    const model = body.model || defaultModel;
    return this.ollama.suggestGenres(body.narrative, model);
  }

  @Post('parse-mmsl')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Parse M-MSL (Micro Music Score Language) notation',
  })
  @ApiResponse({
    status: 200,
    description: 'M-MSL successfully parsed',
    schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'verse' },
              number: { type: 'number', example: 1 },
              chords: {
                type: 'array',
                items: { type: 'string' },
                example: ['Am', 'F', 'C', 'G'],
              },
              performance: { type: 'string', example: 'Play with energy' },
              lyrics: { type: 'string', example: 'Here are the lyrics...' },
            },
          },
        },
        instruments: {
          type: 'array',
          items: { type: 'string' },
          example: ['guitar'],
        },
        tempo: { type: 'number', example: 120 },
        key: { type: 'string', example: 'A minor' },
      },
    },
  })
  async parseMmsl(@Body() body: { mmsl: string }) {
    return this.mmslParser.parse(body.mmsl);
  }

  @Post('validate-mmsl')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Validate M-MSL syntax without parsing' })
  @ApiResponse({
    status: 200,
    description: 'M-MSL validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        errors: { type: 'array', items: { type: 'object' }, example: [] },
      },
    },
  })
  async validateMmsl(@Body() body: { mmsl: string }) {
    return this.mmslParser.validate(body.mmsl);
  }

  @Post('export-stems')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Export song stems in various formats' })
  @ApiResponse({
    status: 200,
    description: 'Stem export initiated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        exportId: { type: 'string', example: 'exp_507f1f77bcf86cd799439011' },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              instrument: { type: 'string', example: 'guitar' },
              filename: { type: 'string', example: 'guitar_stem.wav' },
              size: { type: 'number', example: 2457600 },
              url: {
                type: 'string',
                example: '/downloads/exp_507f1f77/guitar_stem.wav',
              },
            },
          },
        },
        zipUrl: {
          type: 'string',
          example: '/downloads/exp_507f1f77/stems.zip',
        },
      },
    },
  })
  async exportStems(@Body() body: StemExportOptions) {
    const validation = this.stemExport.validateOptions(body);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    return this.stemExport.exportStems(body);
  }
}
