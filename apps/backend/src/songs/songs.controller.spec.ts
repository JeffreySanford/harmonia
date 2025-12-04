import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SongsController } from './songs.controller';
import { OllamaService } from '../llm/ollama.service';
import { MmslParserService } from './mmsl-parser.service';
import { StemExportService } from './stem-export.service';
import { SongDslParserService } from './song-dsl-parser.service';
import { InstrumentCatalogService } from './instrument-catalog.service';

describe('SongsController', () => {
  let controller: SongsController;
  const mockOllama = { generateMetadata: jest.fn() } as any;
  const mockMmslParser = { parse: jest.fn(), validate: jest.fn() } as any;
  const mockStemExport = { export: jest.fn() } as any;
  const mockDslParser = { parse: jest.fn() } as any;
  const mockInstrumentCatalog = { loadCatalog: jest.fn(), getCatalog: jest.fn() } as any;

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
      ],
    }).compile();

    controller = module.get<SongsController>(SongsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call ollama service', async () => {
    mockOllama.generateMetadata.mockResolvedValueOnce({
      title: 'T',
      lyrics: 'L',
      genre: 'pop',
      mood: 'calm',
    });
    const res = await controller.generateMetadata({
      narrative: 'x',
      duration: 30,
      model: 'minstral3',
    } as any);
    expect(mockOllama.generateMetadata).toHaveBeenCalledWith(
      'x',
      30,
      'minstral3'
    );
    expect(res.title).toBe('T');
  });
});
