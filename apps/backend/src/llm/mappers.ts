import { GeneratedMetadata } from './ollama.service';

export type ModelMapper = (raw: any) => Partial<GeneratedMetadata>;

// Generic fallback mapper used when no model-specific mapper exists
export const genericMapper: ModelMapper = (raw: any) => {
  const data = raw?.song || raw || {};
  const title = data.title || data.name || raw.title || raw.name || '';
  let lyrics = '';
  if (Array.isArray(data.lyrics)) {
    lyrics = data.lyrics.join('\n');
  } else {
    lyrics = data.lyrics || data.lyric || raw.lyrics || raw.lyric || '';
  }
  let genre = data.genre || raw.genre || '';
  if (!genre) {
    const arr = data.genres || raw.genres || data.tags || raw.tags;
    if (Array.isArray(arr)) genre = arr[0];
  }
  const mood = data.mood || raw.mood || raw.emotion || '';
  return { title, lyrics, genre, mood };
};

// Deepseek-specific mapper - deepseek returns simple JSON with keys, but sometimes
// uses single quotes or a slightly different structure.
export const deepseekMapper: ModelMapper = (raw: any) => {
  // deepseek often returns direct {title, lyrics, genre, mood}
  return genericMapper(raw);
};

// Minstral3-specific mapper - hypothetical structure example:
// { song: { name: 'X', lyrics: ['a', 'b'] }, genres: ['indie'], mood: 'reflective' }
export const minstral3Mapper: ModelMapper = (raw: any) => {
  const data = raw?.song || raw || {};
  const title = data.name || data.title || raw.title || raw.name || '';
  let lyrics = '';
  if (Array.isArray(data.lyrics)) {
    lyrics = data.lyrics.join('\n');
  } else {
    lyrics = data.lyrics || data.lyric || raw.lyrics || raw.lyric || '';
  }
  let genre = '';
  if (Array.isArray(data.genres)) genre = data.genres[0];
  else if (Array.isArray(raw.genres)) genre = raw.genres[0];
  else if (Array.isArray(raw.tags)) genre = raw.tags[0];
  else genre = data.genre || raw.genre || '';
  const mood = data.mood || raw.mood || raw.emotion || '';
  return { title, lyrics, genre, mood };
};

export const modelMappers: Record<string, ModelMapper | undefined> = {
  // Provide exact model IDs that might be used by Ollama
  deepseek: deepseekMapper,
  'deepseek-coder': deepseekMapper,
  'deepseek-coder:6.7b': deepseekMapper,
  minstral3: minstral3Mapper,
  'minstral3:1.0': minstral3Mapper,
  mistral: minstral3Mapper,
  'mistral:7b': minstral3Mapper,
  'mistral-7b': minstral3Mapper,
};

export function mapResponseForModel(
  model: string,
  raw: any
): Partial<GeneratedMetadata> {
  if (!model) return genericMapper(raw);
  // Match by prefix or exact name for flexibility
  const lower = model.toLowerCase();
  // Try exact
  if (modelMappers[model]) return modelMappers[model](raw);
  // Try lower-case key
  if (modelMappers[lower]) return modelMappers[lower](raw);
  // Try prefix match
  for (const key of Object.keys(modelMappers)) {
    const mapper = modelMappers[key];
    if (!mapper) continue;
    if (lower.startsWith(key)) return mapper(raw);
    if (key.startsWith(lower)) return mapper(raw);
  }
  // fallback to generic
  return genericMapper(raw);
}

export default modelMappers;
