import { Test, TestingModule } from '@nestjs/testing';
import { SongsController } from './songs.controller';
import { OllamaService } from '../llm/ollama.service';

describe('SongsController', () => {
  let controller: SongsController;
  const mockOllama = { generateMetadata: jest.fn() } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      providers: [{ provide: OllamaService, useValue: mockOllama }],
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
