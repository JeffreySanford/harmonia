import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { mapResponseForModel } from './mappers';

export interface GeneratedMetadata {
  title: string;
  lyrics: string;
  genre: string;
  mood: string;
  syllableCount?: number;
}

export interface StructuredSongSection {
  lyrics: string[];
  chords: string[];
}

export interface GeneratedSong {
  title: string;
  artist?: string;
  genre: string;
  tempo: number;
  time_signature?: string;
  key: string;
  mood?: string;
  instrumentation: string[];
  syllableCount?: number;
  wordCount?: number;
  [key: string]: any; // Allow dynamic section properties
}

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Check if Ollama is available during startup
    // Force restart trigger
    try {
      this.logger.log(`Checking Ollama availability at ${this.ollamaUrl}...`);
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 5000,
      });
      const models = response.data?.models || [];
      const availableModels = models.map((m: any) => m.name);
      this.logger.log(
        `Ollama is available with models: ${availableModels.join(', ')}`
      );

      // Check if our configured model is available
      if (!availableModels.includes(this.model)) {
        this.logger.warn(
          `Configured model '${
            this.model
          }' not found in available models: ${availableModels.join(', ')}`
        );
        this.logger.warn('Song generation will fall back to sample metadata');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Ollama is not available at ${this.ollamaUrl}: ${errorMessage}`
      );
      this.logger.warn('Song generation will fall back to sample metadata');
      // Don't throw error - allow app to start with degraded functionality
    }
  }

  private get ollamaUrl(): string {
    return (
      this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434'
    );
  }

  private get model(): string {
    return this.configService.get<string>('OLLAMA_MODEL') || 'mistral:7b';
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

    const prompt = `You are a music metadata generator. Output exactly one JSON object with keys: title, lyrics, genre, mood. Lyrics should be appropriate for a ${durationSeconds}s song and be succinct (3-6 lines). The output must be valid JSON only; no explanatory text.`;
    const body = {
      model,
      prompt: `${prompt}\n\nNarrative: ${narrative}`,
      stream: false,
      options: {
        temperature: 0.6,
        num_predict: 400,
      },
    };

    return from(
      axios.post(`${this.ollamaUrl}/api/generate`, body, { timeout: 20_000 })
    ).pipe(
      map((resp) => {
        const text = resp.data?.response || '';
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

    const prompt = `Generate a complete song structure as JSON. Return ONLY valid JSON, no other text.

{
  "title": "Java and JavaScript",
  "artist": "Your Name",
  "genre": "Nerd Pop",
  "tempo": 120,
  "time_signature": "4/4",
  "key": "C major",
  "mood": "energetic",
  "instrumentation": ["synthesizer", "drums", "bass", "male_voice"],
  "verse_1": {
    "lyrics": [
      "Java, oh Java, you're a staple of the old,",
      "Your syntax elegant, standing tall and bold.",
      "With your Object-Oriented design, you've got it all,"
    ],
    "chords": ["C", "G", "Am", "F"]
  },
  "verse_2": {
    "lyrics": [
      "JavaScript, JavaScript, modern and agile,",
      "In web development, you're the essential file.",
      "Async operations and DOM manipulation, you're a pro,"
    ],
    "chords": ["G", "Am", "F", "C"]
  },
  "chorus": {
    "lyrics": [
      "Together they unite to create harmony.",
      "JavaScript in the browser, Java on the server side,"
    ],
    "chords": ["C", "G", "Am", "F"]
  },
  "bridge": {
    "lyrics": [
      "Though different in syntax and purpose they may be,",
      "Together they unite to create harmony."
    ],
    "chords": ["Am", "Dm7", "G", "C"]
  }
}

Narrative: ${narrative}

Important: Include chord progressions that fit the key and genre. Structure the song with verse_1, verse_2, chorus, and optionally bridge/outro sections.`;
    const body = {
      model,
      prompt: `${prompt}\n\nNarrative: ${narrative}`,
      stream: false,
      options: {
        temperature: 0.3, // Lower temperature for more consistent JSON
        num_predict: 400,
      },
    };

    return from(
      axios.post(`${this.ollamaUrl}/api/generate`, body, { timeout: 25_000 })
    ).pipe(
      map((resp) => {
        const text = resp.data?.response || '';
        this.logger.debug(`Ollama raw response: ${text}`);
        const json = this.extractJson(text);
        if (!json) {
          this.logger.error(`Failed to parse JSON from: ${text}`);
          throw new Error('Unable to parse JSON from model response');
        }
        const normalized = mapResponseForModel(model, json);
        // Convert structured song format to flat format for compatibility
        const song: GeneratedSong = {
          title: normalized.title || 'Untitled',
          artist: json.artist || 'AI Composer',
          genre: normalized.genre || 'pop',
          tempo: json.tempo || this.getDefaultTempo(normalized.genre || 'pop'),
          time_signature: json.time_signature || '4/4',
          key: json.key || 'C major',
          mood: json.mood || 'energetic',
          instrumentation: Array.isArray(json.instrumentation)
            ? json.instrumentation
            : ['piano', 'guitar', 'drums', 'male_voice'],
        };

        // Convert structured sections to flat lyrics
        const sections = ['verse_1', 'verse_2', 'chorus', 'bridge', 'outro'];
        let allLyrics = '';
        let totalSyllables = 0;

        sections.forEach((section) => {
          if (json[section]) {
            song[section] = json[section];
            if (json[section].lyrics) {
              const sectionLyrics = Array.isArray(json[section].lyrics)
                ? json[section].lyrics.join('\n')
                : json[section].lyrics;
              allLyrics += `[${section.toUpperCase()}]\n${sectionLyrics}\n\n`;
              totalSyllables += this.estimateSyllables(sectionLyrics);
            }
          }
        });

        song.syllableCount = totalSyllables;
        song.wordCount = allLyrics.split(/\s+/).length;

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
              title: metadata.title,
              artist: 'AI Composer',
              genre: metadata.genre,
              tempo: this.getDefaultTempo(metadata.genre),
              time_signature: '4/4',
              key: 'C major',
              mood: metadata.mood,
              instrumentation: [
                'piano',
                'guitar',
                'bass',
                'drums',
                'male_voice',
              ],
              verse_1: {
                lyrics: metadata.lyrics.split('\n'),
                chords: ['C', 'G', 'Am', 'F'],
              },
            };
            song.syllableCount = metadata.syllableCount;
            song.wordCount = metadata.lyrics.split(/\s+/).length;
            return song;
          })
        );
      })
    );
  }

  // Normalization handled by per-model mappers in `mappers.ts`

  private extractJson(text: string): any | null {
    // Clean the text first
    const cleaned = text.trim();

    // Try to parse the entire response as JSON first
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // If that fails, try to find JSON within the text
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return null;

      const candidate = cleaned.substring(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch (e2) {
        // Try to replace single quotes with double quotes for common mistakes
        try {
          const fixed = candidate
            .replace(/'/g, '"') // Replace single quotes
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Add quotes around unquoted keys
          return JSON.parse(fixed);
        } catch (e3) {
          return null;
        }
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
