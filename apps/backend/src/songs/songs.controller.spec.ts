import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SongsController } from './songs.controller';
import { OllamaService } from '../llm/ollama.service';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService } from './stem-export.service';
import { SongDslParserService } from './song-dsl-parser.service';
import { InstrumentCatalogService } from './instrument-catalog.service';
import { LyricAnalysisService } from './lyric-analysis.service';
import { PaletteSuggestionService } from './palette-suggestion.service';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';

describe('SongsController', () => {
  let controller: SongsController;
  const mockOllama = { generateMetadata: jest.fn() } as any;
  const mockMmslParser = { parse: jest.fn(), validate: jest.fn() } as any;
  const mockStemExport = {
    validateOptions: jest.fn(),
    exportStems: jest.fn(),
  } as any;
  const mockDslParser = { parse: jest.fn() } as any;
  const mockInstrumentCatalog = {
    loadCatalog: jest.fn(),
    getCatalog: jest.fn(),
  } as any;
  const mockLyricAnalysis = {
    analyzeLyrics: jest.fn(),
  } as any;
  const mockPaletteSuggestion = {
    suggestPalette: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [SongsController],
      providers: [
        { provide: OllamaService, useValue: mockOllama },
        { provide: MmslParserService, useValue: mockMmslParser },
        { provide: StemExportService, useValue: mockStemExport },
        { provide: SongDslParserService, useValue: mockDslParser },
        { provide: InstrumentCatalogService, useValue: mockInstrumentCatalog },
        { provide: LyricAnalysisService, useValue: mockLyricAnalysis },
        { provide: PaletteSuggestionService, useValue: mockPaletteSuggestion },
      ],
    }).compile();

    controller = module.get<SongsController>(SongsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call ollama service', async () => {
    mockOllama.generateMetadata.mockReturnValueOnce(
      of({
        title: 'T',
        lyrics: 'L',
        genre: 'pop',
        mood: 'calm',
      })
    );
    const res = await firstValueFrom(
      controller.generateMetadata({
        narrative: 'x',
        duration: 30,
        model: 'minstral3',
      } as any)
    );
    expect(mockOllama.generateMetadata).toHaveBeenCalledWith(
      'x',
      30,
      'minstral3'
    );
    expect(res.title).toBe('T');
  });
  it('returns no download URLs for generated-only stem artifacts', async () => {
    mockStemExport.validateOptions.mockReturnValueOnce({
      valid: true,
      errors: [],
    });
    mockStemExport.exportStems.mockReturnValueOnce(
      of({
        success: true,
        stems: [
          {
            instrument: 'piano',
            filePath: 'generated/smoke/piano.wav',
            format: 'wav',
            size: 320044,
          },
        ],
        errors: [],
      })
    );

    const result = await firstValueFrom(
      controller.exportStems({
        format: 'wav',
        instruments: ['piano'],
        outputDir: 'generated/smoke',
      })
    );

    expect(result.success).toBe(true);
    expect((result as any).files?.[0]?.url).toBeNull();
    expect((result as any).zipUrl).toBeNull();
  });

  it('returns download URLs only for files under exports/', async () => {
    mockStemExport.validateOptions.mockReturnValueOnce({
      valid: true,
      errors: [],
    });
    mockStemExport.exportStems.mockReturnValueOnce(
      of({
        success: true,
        stems: [
          {
            instrument: 'piano',
            filePath: 'exports/smoke/piano.wav',
            format: 'wav',
            size: 320044,
          },
        ],
        errors: [],
      })
    );

    const result = await firstValueFrom(
      controller.exportStems({
        format: 'wav',
        instruments: ['piano'],
        outputDir: 'exports/smoke',
      })
    );

    expect(result.success).toBe(true);
    expect((result as any).files?.[0]?.url).toBe('/downloads/smoke/piano.wav');
    expect((result as any).zipUrl).toBeNull();
  });
});
