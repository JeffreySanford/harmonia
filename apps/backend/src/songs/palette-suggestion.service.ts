import { Injectable } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { OllamaService } from '../llm/ollama.service';
import {
  InstrumentCatalogService,
  Instrument,
} from './instrument-catalog.service';

export interface PaletteSuggestion {
  genre: string;
  confidence: number; // 0-1
  instruments: Array<{
    id: string;
    name: string;
    category: string;
    role: 'primary' | 'secondary' | 'accent' | 'bass' | 'drums' | 'melody';
    reasoning: string;
  }>;
  mood: string;
  tempoRange: {
    min: number;
    max: number;
    suggested: number;
  };
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface GenreDetection {
  primary: string;
  secondary: string[];
  confidence: number;
  reasoning: string;
}

@Injectable()
export class PaletteSuggestionService {
  constructor(
    private readonly ollama: OllamaService,
    private readonly instrumentCatalog: InstrumentCatalogService
  ) {}

  /**
   * Analyze narrative and suggest optimal instrument palette
   */
  suggestPalette(
    narrative: string,
    modelOverride?: string
  ): Observable<PaletteSuggestion> {
    // First detect the genre from the narrative
    return this.detectGenre(narrative, modelOverride).pipe(
      map((genreDetection) => {
        // Get available instruments for the detected genre
        const availableInstruments = this.getInstrumentsForGenre();

        // Create palette based on genre and narrative analysis
        const palette = this.createPaletteFromGenre(
          genreDetection.primary,
          availableInstruments
        );

        return {
          genre: genreDetection.primary,
          confidence: genreDetection.confidence,
          instruments: palette.instruments,
          mood: this.inferMoodFromNarrative(narrative),
          tempoRange: this.getTempoRangeForGenre(genreDetection.primary),
          complexity: this.determineComplexity(narrative),
        };
      }),
      catchError(() => {
        // Fallback to a basic palette
        const fallbackPalette = this.createFallbackPalette();
        return from(Promise.resolve(fallbackPalette));
      })
    );
  }

  /**
   * Detect musical genre from narrative text
   */
  private detectGenre(
    narrative: string,
    modelOverride?: string
  ): Observable<GenreDetection> {
    return this.ollama.suggestGenres(narrative, modelOverride).pipe(
      map((genres) => {
        if (genres.length === 0) {
          return {
            primary: 'Pop',
            secondary: [],
            confidence: 0.5,
            reasoning: 'No genres suggested, using default',
          };
        }

        return {
          primary: genres[0]!,
          secondary: genres.slice(1, 3),
          confidence: 0.8, // SuggestGenres doesn't provide confidence, assume reasonable confidence
          reasoning: 'Based on genre suggestion analysis',
        };
      })
    );
  }

  /**
   * Get instruments available for a specific genre
   */
  private getInstrumentsForGenre(): Instrument[] {
    const catalog = this.instrumentCatalog.getCatalog();
    if (!catalog) return [];

    // For now, return all instruments - in future we could filter by genre compatibility
    // when the Instrument interface includes genre tags
    return catalog.instruments;
  }

  /**
   * Create instrument palette based on genre and narrative
   */
  private createPaletteFromGenre(
    genre: string,
    availableInstruments: Instrument[]
  ): {
    instruments: Array<{
      id: string;
      name: string;
      category: string;
      role: 'primary' | 'secondary' | 'accent' | 'bass' | 'drums' | 'melody';
      reasoning: string;
    }>;
  } {
    const palette: Array<{
      id: string;
      name: string;
      category: string;
      role: 'primary' | 'secondary' | 'accent' | 'bass' | 'drums' | 'melody';
      reasoning: string;
    }> = [];

    // Define typical instrument roles for each genre
    const genreTemplates: {
      [key: string]: {
        primary: string[];
        secondary: string[];
        accent: string[];
      };
    } = {
      pop: {
        primary: ['piano', 'guitar_electric', 'bass_electric'],
        secondary: ['drums_acoustic', 'synth_pad'],
        accent: ['strings_violin', 'brass_trumpet'],
      },
      rock: {
        primary: ['guitar_electric', 'bass_electric', 'drums_acoustic'],
        secondary: ['piano', 'organ_hammond'],
        accent: ['guitar_acoustic', 'percussion'],
      },
      electronic: {
        primary: ['synth_lead', 'bass_synth', 'drums_electronic'],
        secondary: ['sampler', 'effects_reverb'],
        accent: ['synth_pad', 'sequencer'],
      },
      jazz: {
        primary: ['piano', 'bass_acoustic', 'drums_brushes'],
        secondary: ['saxophone', 'trumpet'],
        accent: ['guitar_jazz', 'vibraphone'],
      },
      classical: {
        primary: ['strings_violin', 'piano', 'cello'],
        secondary: ['flute', 'clarinet'],
        accent: ['harp', 'timpani'],
      },
      // Add more genre templates as needed
    };

    const template = (genreTemplates[genre.toLowerCase()] || genreTemplates.pop) as {
      primary: string[];
      secondary: string[];
      accent: string[];
    };

    // Build palette by finding available instruments that match the template
    const addInstrument = (
      instrumentId: string,
      role: 'primary' | 'secondary' | 'accent' | 'bass' | 'drums' | 'melody'
    ) => {
      const instrument =
        availableInstruments.find((inst) => inst.id === instrumentId) ||
        this.instrumentCatalog.getInstrument(instrumentId);

      if (instrument && !palette.some((p) => p.id === instrument.id)) {
        palette.push({
          id: instrument.id,
          name: instrument.name,
          category: instrument.category,
          role,
          reasoning: `${role} instrument for ${genre} genre`,
        });
      }
    };

    // Add primary instruments (required)
    template.primary.forEach((id: string) => addInstrument(id, 'primary'));

    // Add secondary instruments (recommended)
    template.secondary
      .slice(0, 2)
      .forEach((id: string) => addInstrument(id, 'secondary'));

    // Add one accent instrument (optional)
    if (template.accent.length > 0) {
      const accentId =
        template.accent[Math.floor(Math.random() * template.accent.length)]!;
      addInstrument(accentId, 'accent');
    }

    // Ensure we have at least 3 instruments
    if (palette.length < 3) {
      const fallbackInstruments = availableInstruments
        .filter((inst) => !palette.some((p) => p.id === inst.id))
        .slice(0, 3 - palette.length);

      fallbackInstruments.forEach((inst) => {
        palette.push({
          id: inst.id,
          name: inst.name,
          category: inst.category,
          role: 'secondary',
          reasoning: 'Fallback instrument for minimum palette size',
        });
      });
    }

    return { instruments: palette };
  }

  /**
   * Infer mood from narrative content
   */
  private inferMoodFromNarrative(narrative: string): string {
    const lowerNarrative = narrative.toLowerCase();

    if (
      lowerNarrative.includes('happy') ||
      lowerNarrative.includes('joy') ||
      lowerNarrative.includes('celebration')
    ) {
      return 'upbeat';
    }
    if (
      lowerNarrative.includes('sad') ||
      lowerNarrative.includes('melancholy') ||
      lowerNarrative.includes('loss')
    ) {
      return 'melancholic';
    }
    if (
      lowerNarrative.includes('angry') ||
      lowerNarrative.includes('intense') ||
      lowerNarrative.includes('powerful')
    ) {
      return 'intense';
    }
    if (
      lowerNarrative.includes('calm') ||
      lowerNarrative.includes('peaceful') ||
      lowerNarrative.includes('serene')
    ) {
      return 'calm';
    }
    if (
      lowerNarrative.includes('mysterious') ||
      lowerNarrative.includes('dark') ||
      lowerNarrative.includes('noir')
    ) {
      return 'mysterious';
    }

    return 'neutral';
  }

  /**
   * Get typical tempo range for a genre
   */
  private getTempoRangeForGenre(genre: string): {
    min: number;
    max: number;
    suggested: number;
  } {
    const tempoRanges: {
      [key: string]: { min: number; max: number; suggested: number };
    } = {
      pop: { min: 90, max: 130, suggested: 110 },
      rock: { min: 100, max: 160, suggested: 120 },
      electronic: { min: 120, max: 140, suggested: 128 },
      'hip hop': { min: 80, max: 110, suggested: 90 },
      jazz: { min: 120, max: 200, suggested: 160 },
      blues: { min: 60, max: 120, suggested: 90 },
      classical: { min: 60, max: 120, suggested: 100 },
      country: { min: 80, max: 120, suggested: 100 },
      folk: { min: 90, max: 140, suggested: 110 },
      reggae: { min: 60, max: 90, suggested: 75 },
      metal: { min: 120, max: 200, suggested: 160 },
      gospel: { min: 100, max: 140, suggested: 120 },
    };

    return (
      tempoRanges[genre.toLowerCase()] || { min: 90, max: 130, suggested: 110 }
    );
  }

  /**
   * Determine complexity based on narrative length and content
   */
  private determineComplexity(
    narrative: string
  ): 'simple' | 'moderate' | 'complex' {
    const wordCount = narrative.split(/\s+/).length;

    if (wordCount < 50) return 'simple';
    if (wordCount < 150) return 'moderate';
    return 'complex';
  }

  /**
   * Create a fallback palette when analysis fails
   */
  private createFallbackPalette(): PaletteSuggestion {
    return {
      genre: 'Pop',
      confidence: 0.5,
      instruments: [
        {
          id: 'piano',
          name: 'Piano',
          category: 'keyboard',
          role: 'primary',
          reasoning: 'Fallback primary instrument',
        },
        {
          id: 'guitar_acoustic',
          name: 'Acoustic Guitar',
          category: 'guitar',
          role: 'secondary',
          reasoning: 'Fallback secondary instrument',
        },
        {
          id: 'drums_acoustic',
          name: 'Acoustic Drums',
          category: 'drums',
          role: 'primary',
          reasoning: 'Fallback rhythm instrument',
        },
      ],
      mood: 'neutral',
      tempoRange: { min: 90, max: 130, suggested: 110 },
      complexity: 'moderate',
    };
  }
}
