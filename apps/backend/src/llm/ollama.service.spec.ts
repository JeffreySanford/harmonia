import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from './ollama.service';
import { LyricAnalysisService } from '../songs/lyric-analysis.service';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaService', () => {
  let service: OllamaService;

  beforeEach(async () => {
    service = await createServiceWithModel();
  });

  async function createServiceWithModel(model?: string) {
    const old = process.env.OLLAMA_MODEL;
    if (model) process.env.OLLAMA_MODEL = model;
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [OllamaService, LyricAnalysisService],
    }).compile();
    const created = module.get<OllamaService>(OllamaService);
    // restore env
    if (old === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = old;
    return created;
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return fallback sample when axios fails', async () => {
    service = await createServiceWithModel('deepseek');
    mockedAxios.post.mockRejectedValueOnce(new Error('network'));
    const res = await firstValueFrom(
      service.generateMetadata('short story', 30)
    );
    expect(res.title).toBeDefined();
    expect(res.lyrics).toBeDefined();
  });

  it('should normalize deepseek-style direct JSON', async () => {
    service = await createServiceWithModel('deepseek');
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: '{"title":"D","lyrics":"a b","genre":"rock","mood":"happy"}',
          },
        ],
      },
    });
    const res = await firstValueFrom(service.generateMetadata('narrative', 60));
    expect(res.title).toBe('D');
    expect(res.genre).toBe('rock');
    expect(res.mood).toBe('happy');
    expect(res.syllableCount).toBeGreaterThan(0);
  });

  it('should normalize minstral3-style nested JSON', async () => {
    service = await createServiceWithModel('minstral3');
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: '{"song":{"name":"M","lyrics":["line1","line2"]},"genres":["indie","folk"],"mood":"reflective"}',
          },
        ],
      },
    });
    const res = await firstValueFrom(service.generateMetadata('story', 120));
    expect(res.title).toBe('M');
    expect(res.genre).toBe('indie');
    expect(res.mood).toBe('reflective');
    expect(res.lyrics.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('should accept model override param', async () => {
    service = await createServiceWithModel('deepseek');
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: '{"song":{"name":"M","lyrics":["o1","o2"]},"genres":["indie"],"mood":"calm"}',
          },
        ],
      },
    });
    const res = await firstValueFrom(
      service.generateMetadata('story', 30, 'minstral3')
    );
    expect(res.title).toBe('M');
    expect(res.genre).toBe('indie');
    expect(res.mood).toBe('calm');
  });

  it('should generate full song with melody, tempo, and instrumentation', async () => {
    service = await createServiceWithModel('deepseek');
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: '{"title":"Test Song","lyrics":"Verse 1\\nChorus","genre":"pop","mood":"happy","melody":"Upbeat melody","tempo":120,"key":"C major","instrumentation":["piano","drums","bass"]}',
          },
        ],
      },
    });
    const res = await firstValueFrom(service.generateSong('happy story', 180));
    expect(res.title).toBe('Test Song');
    expect(res.lyrics).toBe('Verse 1\nChorus');
    expect(res.genre).toBe('pop');
    expect(res.mood).toBe('happy');
    expect(res.melody).toBe('Upbeat melody');
    expect(res.tempo).toBe(120);
    expect(res.key).toBe('C major');
    expect(res.instrumentation).toEqual(['piano', 'drums', 'bass']);
  });
});
