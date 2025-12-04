import {
  deepseekMapper,
  minstral3Mapper,
  genericMapper,
  mapResponseForModel,
} from './mappers';

describe('LLM Model Mappers', () => {
  it('deepseekMapper should map direct JSON to canonical form', () => {
    const raw = {
      title: 'D',
      lyrics: 'a\nb',
      genre: 'rock',
      mood: 'happy',
    } as any;
    const out = deepseekMapper(raw);
    expect(out.title).toBe('D');
    expect(out.genre).toBe('rock');
    expect(out.mood).toBe('happy');
    expect(out.lyrics).toBe('a\nb');
  });

  it('minstral3Mapper should map nested JSON to canonical form', () => {
    const raw = {
      song: { name: 'M', lyrics: ['line1', 'line2'] },
      genres: ['indie', 'folk'],
      mood: 'reflective',
    } as any;
    const out = minstral3Mapper(raw);
    expect(out.title).toBe('M');
    expect(out.genre).toBe('indie');
    expect(out.mood).toBe('reflective');
    expect(out.lyrics).toBeDefined();
    expect((out.lyrics || '').split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('genericMapper should fall back for unknown shapes', () => {
    const raw = { unknown: 'value', lyrics: 'x' } as any;
    const out = genericMapper(raw);
    expect(out.lyrics).toBe('x');
  });

  it('should choose deepseek mapper for deepseek-coder:6.7b model id', () => {
    const raw = {
      title: 'D',
      lyrics: 'a\nb',
      genre: 'rock',
      mood: 'happy',
    } as any;
    const out = mapResponseForModel('deepseek-coder:6.7b', raw);
    expect(out.title).toBe('D');
  });

  it('should choose minstral3 mapper for minstral3 alias', () => {
    const raw = {
      song: { name: 'M', lyrics: ['l1', 'l2'] },
      genres: ['indie'],
    } as any;
    const out = mapResponseForModel('minstral3:1.0', raw);
    expect(out.title).toBe('M');
    expect(out.genre).toBe('indie');
  });
});
