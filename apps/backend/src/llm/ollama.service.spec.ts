import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from './ollama.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaService', () => {
  let service: OllamaService;

  async function createServiceWithModel(model?: string) {
    const old = process.env.OLLAMA_MODEL;
    if (model) process.env.OLLAMA_MODEL = model;
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [OllamaService],
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
    const res = await service.generateMetadata('short story', 30);
    expect(res.title).toBeDefined();
    expect(res.lyrics).toBeDefined();
  });

  it('should normalize deepseek-style direct JSON', async () => {
    service = await createServiceWithModel('deepseek');
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            text: '{"title":"D","lyrics":"a\nb","genre":"rock","mood":"happy"}',
          },
        ],
      },
    });
    const res = await service.generateMetadata('narrative', 60);
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
    const res = await service.generateMetadata('story', 120);
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
    const res = await service.generateMetadata('story', 30, 'minstral3');
    expect(res.title).toBe('M');
    expect(res.genre).toBe('indie');
    expect(res.mood).toBe('calm');
  });
});
