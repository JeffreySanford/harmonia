import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { mapResponseForModel } from './mappers';
import { LyricAnalysisService } from '../songs/lyric-analysis.service';

export interface GeneratedMetadata {
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
  syllableCount?: number;
}

export interface GeneratedSong extends GeneratedMetadata {
  melody?: string; // Musical notation or description
  tempo?: number; // BPM
  key?: string; // Musical key
  instrumentation?: string[]; // Suggested instruments
  intro?: {
    enabled: boolean;
    style: 'with-music' | 'sung' | 'no-music';
    content?: string; // Optional lyrics or description for intro
  };
  outro?: {
    enabled: boolean;
    style: 'with-music' | 'sung' | 'no-music';
    content?: string; // Optional lyrics or description for outro
  };
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly lyricAnalysis: LyricAnalysisService
  ) {}

  private get ollamaUrl(): string {
    return (
      this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434'
    );
  }

  private get model(): string {
    return this.configService.get<string>('OLLAMA_MODEL') || 'deepseek-coder';
  }

  generateMetadata(
    narrative: string,
    durationSeconds: number,
    modelOverride?: string
  ): Observable<GeneratedMetadata> {
    const model = modelOverride || this.model;
    // Guard: limit narrative length
    const maxLen = 1000;
    if (narrative.length > maxLen) {
      narrative = narrative.slice(0, maxLen);
    }

    // Get optimal lyric constraints based on attention span modeling
    const optimalLineCount = this.lyricAnalysis.getOptimalLineCount(durationSeconds);
    const diversityGuidelines = this.lyricAnalysis.getDiversityGuidelines();

    const prompt = `You are a music metadata generator. Output exactly one JSON object with keys: title, lyrics, genre, mood.

LYRICS REQUIREMENTS:
- Length: ${optimalLineCount} lines maximum (appropriate for ${durationSeconds}s song)
- Diversity: ${diversityGuidelines}
- Quality: Avoid repetitive filler words, maintain engagement throughout
- Structure: Clear progression with variety in rhythm and content

The output must be valid JSON only; no explanatory text.`;
    const body = {
      model,
      prompt: `${prompt}\n\nNarrative: ${narrative}`,
      temperature: 0.6,
      max_tokens: 400,
    };

    return from(
      axios.post(`${this.ollamaUrl}/v1/completions`, body, { timeout: 20_000 })
    ).pipe(
      map((resp) => {
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
      }),
      catchError((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          'Ollama model call failed, falling back to sample metadata: ' + msg
        );
        // Fallback generated metadata - same shape as in frontend sample
        const sample = this.generateSample(narrative, durationSeconds);
        return [sample];
      })
    );
  }

  suggestGenres(
    narrative: string,
    modelOverride?: string
  ): Observable<string[]> {
    const model = modelOverride || this.model;
    // Guard: limit narrative length
    const maxLen = 1000;
    if (narrative.length > maxLen) {
      narrative = narrative.slice(0, maxLen);
    }

    const prompt = `You are a music genre expert. Analyze the following narrative and suggest 3-5 musical genres that would best fit this story. Return exactly a JSON array of genre names from our available genres. Available genres: 1940s Big Band, Rat Pack (Swing/Lounge), Jazz, Blues, Rock 'n' Roll, Classical, Pop, Hip Hop, Country, Folk, Electronic/Dance, Reggae, Industrial, House, Metal, Gospel, Melodic Rock Ballads.

Output must be valid JSON array only; no explanatory text.`;

    const body = {
      model,
      prompt: `${prompt}\n\nNarrative: ${narrative}`,
      temperature: 0.3,
      max_tokens: 200,
    };

    return from(
      axios.post(`${this.ollamaUrl}/v1/completions`, body, { timeout: 15_000 })
    ).pipe(
      map((resp) => {
        const text = resp.data?.choices?.[0]?.text || resp.data?.text || '';
        const json = this.extractJson(text);
        if (Array.isArray(json)) {
          return json;
        } else {
          throw new Error('Response is not a valid genre array');
        }
      }),
      catchError((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          'Ollama genre suggestion failed, falling back to defaults: ' + msg
        );
        // Fallback: return some general genres
        return [['Pop', 'Rock', 'Electronic/Dance']];
      })
    );
  }

  generateSong(
    narrative: string,
    durationSeconds: number,
    modelOverride?: string
  ): Observable<GeneratedSong> {
    const model = modelOverride || this.model;
    // Guard: limit narrative length
    const maxLen = 1500;
    if (narrative.length > maxLen) {
      narrative = narrative.slice(0, maxLen);
    }

    // Get optimal lyric constraints based on attention span modeling
    const optimalLineCount = this.lyricAnalysis.getOptimalLineCount(durationSeconds);
    const diversityGuidelines = this.lyricAnalysis.getDiversityGuidelines();

    const prompt = `You are a complete song generator. Create a full song from the narrative. Output exactly one JSON object with keys: title, lyrics, genre, mood, melody, tempo, key, instrumentation, intro, outro. 

Requirements:
- Lyrics: ${optimalLineCount} lines maximum (appropriate for ${durationSeconds}s song) - ${diversityGuidelines}
- Melody: Brief description of the melody style (e.g., "upbeat pop melody with chorus hooks")
- Tempo: BPM between 60-180 appropriate for the genre
- Key: Musical key (e.g., "C major", "A minor")
- Instrumentation: Array of 3-5 suggested instruments
- Intro: Object with enabled (boolean), style ("with-music"|"sung"|"no-music"), optional content
- Outro: Object with enabled (boolean), style ("with-music"|"sung"|"no-music"), optional content
- Output must be valid JSON only; no explanatory text.`;

    const body = {
      model,
      prompt: `${prompt}\n\nNarrative: ${narrative}`,
      temperature: 0.7,
      max_tokens: 600,
    };

    return from(
      axios.post(`${this.ollamaUrl}/v1/completions`, body, { timeout: 25_000 })
    ).pipe(
      map((resp) => {
        const text = resp.data?.choices?.[0]?.text || resp.data?.text || '';
        const json = this.extractJson(text);
        if (!json) {
          throw new Error('Unable to parse JSON from model response');
        }
        const normalized = mapResponseForModel(model, json);
        const song: GeneratedSong = {
          title: normalized.title || 'Untitled',
          lyrics: normalized.lyrics || '',
          genre: normalized.genre || 'pop',
          mood: normalized.mood || 'calm',
          melody: json.melody || json.melody_description || 'Catchy melody',
          tempo: json.tempo || this.getDefaultTempo(normalized.genre || 'pop'),
          key: json.key || 'C major',
          instrumentation: Array.isArray(json.instrumentation)
            ? json.instrumentation
            : ['piano', 'guitar', 'drums'],
          intro: json.intro || { enabled: false, style: 'no-music' },
          outro: json.outro || { enabled: false, style: 'no-music' },
        };
        song.syllableCount = this.estimateSyllables(song.lyrics);
        return song;
      }),
      catchError((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          'Ollama song generation failed, falling back to metadata + defaults: ' +
            msg
        );
        // Fallback: generate metadata + add default song elements
        return this.generateMetadata(narrative, durationSeconds, model).pipe(
          map((metadata) => {
            const song: GeneratedSong = {
              ...metadata,
              melody: 'Upbeat melody with verse-chorus structure',
              tempo: this.getDefaultTempo(metadata.genre),
              key: 'C major',
              instrumentation: ['piano', 'guitar', 'bass', 'drums'],
            };
            return song;
          })
        );
      })
    );
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

  private getDefaultTempo(genre: string): number {
    const genreTempos: Record<string, number> = {
      '1940s big band': 180,
      'rat pack (swing/lounge)': 140,
      jazz: 120,
      blues: 90,
      "rock 'n' roll": 160,
      classical: 110,
      pop: 120,
      'hip hop': 95,
      country: 110,
      folk: 100,
      'electronic/dance': 128,
      reggae: 80,
      industrial: 130,
      house: 125,
      metal: 150,
      gospel: 100,
      'melodic rock ballads': 85,
    };
    return genreTempos[genre.toLowerCase()] || 120;
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
