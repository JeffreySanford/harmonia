import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { mapResponseForModel } from './mappers';

export interface GeneratedMetadata {
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
  syllableCount?: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  constructor(private readonly configService: ConfigService) {}

  private get ollamaUrl(): string {
    return (
      this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434'
    );
  }

  private get model(): string {
    return this.configService.get<string>('OLLAMA_MODEL') || 'deepseek';
  }

  async generateMetadata(
    narrative: string,
    durationSeconds: number,
    modelOverride?: string
  ): Promise<GeneratedMetadata> {
    const model = modelOverride || this.model;
    // Guard: limit narrative length
    const maxLen = 1000;
    if (narrative.length > maxLen) {
      narrative = narrative.slice(0, maxLen);
    }

    const prompt = `You are a music metadata generator. Output exactly one JSON object with keys: title, lyrics, genre, mood. Lyrics should be appropriate for a ${durationSeconds}s song and be succinct (3-6 lines). The output must be valid JSON only; no explanatory text.`;
    const body = {
      model,
      prompt: `${prompt}\n\nNarrative: ${narrative}`,
      temperature: 0.6,
      max_tokens: 400,
    };

    try {
      const url = `${this.ollamaUrl}/v1/completions`;
      const resp = await axios.post(url, body, { timeout: 20_000 });
      const text = resp.data?.choices?.[0]?.text || resp.data?.text || '';
      // Try to extract JSON from the resulting text
      const json = this.extractJson(text);
      if (!json) {
        throw new Error('Unable to parse JSON from model response');
      }
      const normalized = mapResponseForModel(model, json);
      const metadata: GeneratedMetadata = {
        title: normalized.title || 'Untitled',
        lyrics: normalized.lyrics || '',
        genre: normalized.genre || 'pop',
        mood: normalized.mood || 'calm',
      };
      metadata.syllableCount = this.estimateSyllables(metadata.lyrics);
      return metadata;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        'Ollama model call failed, falling back to sample metadata: ' + msg
      );
      // Fallback generated metadata - same shape as in frontend sample
      const sample = this.generateSample(narrative, durationSeconds);
      return sample;
    }
  }

  // Normalization handled by per-model mappers in `mappers.ts`

  private extractJson(text: string): any | null {
    // Find the first '{' and last '}' and try to parse
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = text.substring(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // Try to replace single quotes and parse loosely
      try {
        return JSON.parse(candidate.replace(/'/g, '"'));
      } catch (e2) {
        return null;
      }
    }
  }

  private estimateSyllables(text: string): number {
    if (!text) return 0;
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/);
    return words.reduce((count, word) => {
      if (!word) return count;
      const groups = word.match(/[aeiouy]+/g);
      let s = groups ? groups.length : 0;
      if (word.endsWith('e') && s > 1) s--;
      return count + Math.max(1, s);
    }, 0);
  }

  private generateSample(
    narrative: string,
    durationSeconds: number
  ): GeneratedMetadata {
    // Minimal fallback generator
    const first = (narrative && narrative.split(/\.|,|\n/)[0]) || '';
    const title = (first && first.slice(0, 40)) || 'Untitled';
    // Keep the lyrics length roughly aligned with duration via repeats
    let lyrics =
      'Walking through the rain\nYour shadow by my side\nEchoes of goodbye';
    // We don't use durationSeconds heavily here but use it to repeat verses if longer
    const targetWords = Math.round(((durationSeconds || 30) * 4.5) / 4);
    let currentWords = lyrics.split(/\s+/).length;
    while (currentWords < targetWords) {
      lyrics += '\n' + 'Walking through the rain';
      currentWords = lyrics.split(/\s+/).length;
    }
    const genre = 'pop';
    const mood = 'melancholic';
    return {
      title,
      lyrics,
      genre,
      mood,
      syllableCount: this.estimateSyllables(lyrics),
    };
  }
}

export default OllamaService;
