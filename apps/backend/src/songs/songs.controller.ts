import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GenerateMetadataDto } from './dto/generate-metadata.dto';
import { AnalyzeLyricsDto } from './dto/analyze-lyrics.dto';
import { OllamaService } from '../llm/ollama.service';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService, StemExportOptions } from './stem-export.service';
import { SongDslParserService } from './song-dsl-parser.service';
import { InstrumentCatalogService } from './instrument-catalog.service';

@Controller('songs')
@ApiTags('songs')
export class SongsController {
  constructor(
    private readonly ollama: OllamaService,
    private readonly configService: ConfigService,
    private readonly mmslParser: MmslParserService,
    private readonly stemExport: StemExportService,
    private readonly dslParser: SongDslParserService,
    private readonly instrumentCatalog: InstrumentCatalogService
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
  @ApiOperation({
    summary: 'Generate complete song with lyrics, melody, and instrumentation',
  })
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
        melody: {
          type: 'string',
          example: 'Upbeat acoustic guitar melody with vocal harmonies',
        },
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
            style: {
              type: 'string',
              enum: ['with-music', 'sung', 'no-music'],
              example: 'with-music',
            },
            content: { type: 'string', example: 'Soft guitar intro' },
          },
        },
        outro: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: false },
            style: {
              type: 'string',
              enum: ['with-music', 'sung', 'no-music'],
              example: 'no-music',
            },
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

  @Post('analyze-lyrics')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Analyze and parse lyrics using Song Annotation DSL',
    description:
      'Parse pre-written lyrics with Song Annotation DSL markers ([Section], (Performance), <Audio Cue>) into structured format for music generation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lyrics successfully analyzed and parsed',
    schema: {
      type: 'object',
      properties: {
        song: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Nightfall' },
            bpm: { type: 'number', example: 92 },
            key: { type: 'string', example: 'Em' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'verse-1' },
                  label: { type: 'string', example: 'Verse 1' },
                  items: {
                    type: 'array',
                    items: {
                      oneOf: [
                        {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['performance'] },
                            text: { type: 'string', example: 'soft spoken' },
                          },
                        },
                        {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['lyric'] },
                            text: {
                              type: 'string',
                              example: 'I walk into the night...',
                            },
                          },
                        },
                        {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['cue'] },
                            cue_type: { type: 'string', example: 'sfx' },
                            name: { type: 'string', example: 'footsteps' },
                            params: {
                              type: 'object',
                              example: {
                                repeat: 4,
                                duration: '2s',
                                pan: 'center',
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              line: { type: 'number', example: 5 },
              message: {
                type: 'string',
                example: 'Invalid duration: 500. Must be between 0-300 seconds',
              },
              severity: {
                type: 'string',
                enum: ['error', 'warning'],
                example: 'error',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid lyrics or DSL syntax' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid authentication',
  })
  async analyzeLyrics(@Body() body: AnalyzeLyricsDto) {
    const result = this.dslParser.parseSong(body.lyrics);

    // If validateOnly is true, return only validation result
    if (body.validateOnly) {
      return {
        valid: result.errors.filter((e) => e.severity === 'error').length === 0,
        errors: result.errors,
      };
    }

    return result;
  }

  @Post('validate-instrument-catalog')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate instrument catalog JSON schema and semantics' })
  @ApiResponse({
    status: 200,
    description: 'Instrument catalog validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        errors: {
          type: 'array',
          items: { type: 'string' },
          example: [],
        },
        catalog: {
          type: 'object',
          properties: {
            version: { type: 'string', example: '1.0.0' },
            instruments_count: { type: 'number', example: 45 },
            categories: {
              type: 'array',
              items: { type: 'string' },
              example: ['strings', 'woodwinds', 'brass'],
            },
          },
        },
      },
    },
  })
  async validateInstrumentCatalog(@Body() body: { catalogPath?: string }) {
    const result = await this.instrumentCatalog.loadCatalog(body.catalogPath);

    if (result.valid) {
      const catalog = this.instrumentCatalog.getCatalog();
      return {
        valid: true,
        errors: [],
        catalog: catalog ? {
          version: catalog.version,
          instruments_count: catalog.instruments.length,
          categories: catalog.categories,
        } : null,
      };
    }

    return result;
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
