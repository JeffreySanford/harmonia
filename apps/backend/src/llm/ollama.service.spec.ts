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
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
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
        response:
          '{"title":"D","lyrics":"a b","genre":"rock","mood":"happy"}',
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
        response:
          '{"song":{"name":"M","lyrics":["line1","line2"]},"genres":["indie","folk"],"mood":"reflective"}',
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
        response:
          '{"song":{"name":"M","lyrics":["o1","o2"]},"genres":["indie"],"mood":"calm"}',
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
        response: JSON.stringify({
          title: 'Test Song',
          genre: 'pop',
          mood: 'happy',
          tempo: 120,
          key: 'C major',
          instrumentation: ['piano', 'drums', 'bass'],
          verse_1: {
            lyrics: ['Verse 1'],
            chords: ['C', 'G'],
          },
          chorus: {
            lyrics: ['Chorus'],
            chords: ['F', 'G'],
          },
        }),
      },
    });
    const res = await firstValueFrom(service.generateSong('happy story', 180));
    expect(res.title).toBe('Test Song');
    expect(res.genre).toBe('pop');
    expect(res.mood).toBe('happy');
    expect(res.tempo).toBe(120);
    expect(res.key).toBe('C major');
    expect(res.instrumentation).toEqual(['piano', 'drums', 'bass']);
    expect(res.verse_1).toEqual({
      lyrics: ['Verse 1'],
      chords: ['C', 'G'],
    });
    expect(res.chorus).toEqual({
      lyrics: ['Chorus'],
      chords: ['F', 'G'],
    });
    expect(res.syllableCount).toBeGreaterThan(0);
    expect(res.wordCount).toBeGreaterThan(0);
  });
});
