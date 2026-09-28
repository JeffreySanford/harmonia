import type { GeneratedMetadata } from './ollama.service';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type ModelMapper =
  (raw: JsonObject) => Partial<GeneratedMetadata>;

export function isJsonObject(
  value: JsonValue | undefined
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function firstString(
  ...values: Array<JsonValue | undefined>
): string {
  for (const value of values) {
    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

function stringArray(
  value: JsonValue | undefined
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === 'string'
  );
}

// Generic fallback mapper used when no model-specific mapper exists
export const genericMapper: ModelMapper = (raw) => {
  const data =
    isJsonObject(raw.song)
      ? raw.song
      : raw;

  const title =
    firstString(
      data.title,
      data.name,
      raw.title,
      raw.name
    );

  const lyricLines =
    stringArray(
      data.lyrics
    );

  const lyrics =
    lyricLines.length > 0
      ? lyricLines.join('\n')
      : firstString(
          data.lyrics,
          data.lyric,
          raw.lyrics,
          raw.lyric
        );

  let genre =
    firstString(
      data.genre,
      raw.genre
    );

  if (!genre) {
    const candidates = [
      data.genres,
      raw.genres,
      data.tags,
      raw.tags,
    ];

    for (const candidate of candidates) {
      const genres =
        stringArray(
          candidate
        );

      if (genres.length > 0) {
        genre =
          genres[0] || '';

        break;
      }
    }
  }

  const mood =
    firstString(
      data.mood,
      raw.mood,
      raw.emotion
    );

  return {
    title,
    lyrics,
    genre,
    mood,
  };
};

// Deepseek-specific mapper - deepseek returns simple JSON with keys, but sometimes
// uses single quotes or a slightly different structure.
export const deepseekMapper: ModelMapper = (raw) => {
  return genericMapper(raw);
};

// Minstral3-specific mapper - hypothetical structure example:
// { song: { name: 'X', lyrics: ['a', 'b'] }, genres: ['indie'], mood: 'reflective' }
export const minstral3Mapper: ModelMapper = (raw) => {
  const data =
    isJsonObject(raw.song)
      ? raw.song
      : raw;

  const title =
    firstString(
      data.name,
      data.title,
      raw.title,
      raw.name
    );

  const lyricLines =
    stringArray(
      data.lyrics
    );

  const lyrics =
    lyricLines.length > 0
      ? lyricLines.join('\n')
      : firstString(
          data.lyrics,
          data.lyric,
          raw.lyrics,
          raw.lyric
        );

  const dataGenres =
    stringArray(
      data.genres
    );

  const rawGenres =
    stringArray(
      raw.genres
    );

  const rawTags =
    stringArray(
      raw.tags
    );

  const genre =
    dataGenres[0] ||
    rawGenres[0] ||
    rawTags[0] ||
    firstString(
      data.genre,
      raw.genre
    );

  const mood =
    firstString(
      data.mood,
      raw.mood,
      raw.emotion
    );

  return {
    title,
    lyrics,
    genre,
    mood,
  };
};

export const modelMappers:
  Record<string, ModelMapper | undefined> = {
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
  raw: JsonObject
): Partial<GeneratedMetadata> {
  if (!model) {
    return genericMapper(raw);
  }

  const lower =
    model.toLowerCase();

  const exact =
    modelMappers[model];

  if (exact) {
    return exact(raw);
  }

  const normalized =
    modelMappers[lower];

  if (normalized) {
    return normalized(raw);
  }

  for (
    const [
      key,
      mapper,
    ] of Object.entries(
      modelMappers
    )
  ) {
    if (!mapper) {
      continue;
    }

    if (
      lower.startsWith(key) ||
      key.startsWith(lower)
    ) {
      return mapper(raw);
    }
  }

  return genericMapper(raw);
}

export default modelMappers;
