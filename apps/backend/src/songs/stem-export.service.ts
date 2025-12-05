import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap, mergeMap, toArray } from 'rxjs/operators';
import { InstrumentCatalogService, Instrument } from './instrument-catalog.service';

export interface StemExportOptions {
  format: 'wav' | 'mp3';
  instruments: string[];
  outputDir: string;
  sampleRate?: number;
  useFallbacks?: boolean; // Enable fallback system for missing instruments
}

export interface StemExportResult {
  success: boolean;
  stems: Array<{
    instrument: string;
    filePath: string;
    format: string;
    size: number;
    fallbackUsed?: string; // Which fallback instrument was used
  }>;
  errors: string[];
  warnings: string[]; // Non-fatal issues like fallbacks used
}

@Injectable()
export class StemExportService {
  constructor(private readonly instrumentCatalog: InstrumentCatalogService) {}

  /**
   * Export per-instrument stems in the specified format with fallback support
   * This is a basic implementation that creates placeholder audio files
   * In production, this would synthesize actual audio from instrument data
   */
  exportStems(options: StemExportOptions): Observable<StemExportResult> {
    // Create observables for file operations
    const mkdirObservable = (dirPath: string) => {
      return new Observable<void>((observer) => {
        fs.mkdir(dirPath, { recursive: true }, (err) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next();
            observer.complete();
          }
        });
      });
    };

    const writeFileObservable = (filePath: string, data: Buffer) => {
      return new Observable<void>((observer) => {
        fs.writeFile(filePath, data, (err) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next();
            observer.complete();
          }
        });
      });
    };

    const statObservable = (filePath: string) => {
      return new Observable<fs.Stats>((observer) => {
        fs.stat(filePath, (err, stats) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next(stats);
            observer.complete();
          }
        });
      });
    };

    // Start with creating the output directory
    return mkdirObservable(options.outputDir).pipe(
      switchMap(() => {
        // Resolve instruments with fallbacks
        const resolvedInstruments = this.resolveInstrumentsWithFallbacks(
          options.instruments,
          options.useFallbacks ?? true
        );

        // Process each resolved instrument reactively
        const instrumentObservables = resolvedInstruments.map((resolution) => {
          const fileName = `${resolution.effectiveInstrument.replace(
            /[^a-zA-Z0-9]/g,
            '_'
          )}.${options.format}`;
          const filePath = path.join(options.outputDir, fileName);
          const audioData = this.generateWavPlaceholder();

          return writeFileObservable(filePath, audioData).pipe(
            switchMap(() => statObservable(filePath)),
            map((stats) => ({
              instrument: resolution.requestedInstrument,
              filePath,
              format: options.format,
              size: stats.size,
              fallbackUsed: resolution.fallbackUsed
                ? resolution.effectiveInstrument
                : undefined,
            })),
            catchError((error) => {
              const errorMsg = `Failed to export stem for ${
                resolution.requestedInstrument
              }: ${error instanceof Error ? error.message : 'Unknown error'}`;
              return [{ error: errorMsg }];
            })
          );
        });

        return from(instrumentObservables).pipe(
          mergeMap((obs) => obs),
          toArray()
        );
      }),
      map((results) => {
        const stems = results.filter(
          (result) => !('error' in result)
        ) as Array<{
          instrument: string;
          filePath: string;
          format: string;
          size: number;
          fallbackUsed?: string;
        }>;
        const errors = results
          .filter((result) => 'error' in result)
          .map((result) => (result as any).error);

        // Generate warnings for fallbacks used
        const warnings: string[] = [];
        const fallbackUsed = stems.filter((stem) => stem.fallbackUsed);
        if (fallbackUsed.length > 0) {
          warnings.push(
            `Fallback instruments used: ${fallbackUsed
              .map((s) => `${s.instrument} → ${s.fallbackUsed}`)
              .join(', ')}`
          );
        }

        const result: StemExportResult = {
          success: errors.length === 0,
          stems,
          errors,
          warnings,
        };

        return result;
      }),
      catchError((error) => {
        const result: StemExportResult = {
          success: false,
          stems: [],
          errors: [
            `Export failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          ],
          warnings: [],
        };
        return from(Promise.resolve(result));
      })
    );
  }
  /**
   * Resolve instruments with fallback logic
   * Returns an array of instrument resolutions that can be used for export
   */
  private resolveInstrumentsWithFallbacks(
    requestedInstruments: string[],
    useFallbacks: boolean
  ): Array<{
    requestedInstrument: string;
    effectiveInstrument: string;
    fallbackUsed: boolean;
  }> {
    const resolutions: Array<{
      requestedInstrument: string;
      effectiveInstrument: string;
      fallbackUsed: boolean;
    }> = [];

    // Track polyphony usage to enforce limits
    const polyphonyUsage = new Map<string, number>();

    for (const requestedId of requestedInstruments) {
      let effectiveInstrument = requestedId;
      let fallbackUsed = false;

      // Check if the requested instrument exists
      const instrument = this.instrumentCatalog.getInstrument(requestedId);

      if (!instrument) {
        if (useFallbacks) {
          // Try to find a fallback
          const fallbacks = this.findBestFallback(requestedId);
          if (fallbacks.length > 0) {
            effectiveInstrument = fallbacks[0]!.id;
            fallbackUsed = true;
          } else {
            // No fallback available, use a default silent instrument
            effectiveInstrument = 'default_silence';
            fallbackUsed = true;
          }
        } else {
          // No fallbacks allowed, keep original (will fail validation)
          effectiveInstrument = requestedId;
        }
      }

      // Check polyphony limits
      if (instrument?.polyphony_limit) {
        const currentUsage = polyphonyUsage.get(effectiveInstrument) || 0;
        if (currentUsage >= instrument.polyphony_limit) {
          if (useFallbacks) {
            // Find alternative instrument that doesn't exceed polyphony
            const alternative = this.findAlternativeForPolyphony(
              effectiveInstrument,
              polyphonyUsage
            );
            if (alternative) {
              effectiveInstrument = alternative.id;
              fallbackUsed = true;
            }
          }
        }
      }

      // Update polyphony usage
      const effectiveInst =
        this.instrumentCatalog.getInstrument(effectiveInstrument);
      if (effectiveInst?.polyphony_limit) {
        polyphonyUsage.set(
          effectiveInstrument,
          (polyphonyUsage.get(effectiveInstrument) || 0) + 1
        );
      }

      resolutions.push({
        requestedInstrument: requestedId,
        effectiveInstrument,
        fallbackUsed,
      });
    }

    return resolutions;
  }

  /**
   * Find the best fallback instrument for a missing instrument
   */
  private findBestFallback(missingInstrumentId: string): Instrument[] {
    // First, try direct fallback rules from any instrument that references this one
    const catalog = this.instrumentCatalog.getCatalog();
    if (!catalog) return [];

    // Look for instruments that have this as a fallback
    for (const instrument of catalog.instruments) {
      if (instrument.fallback_rules?.includes(missingInstrumentId)) {
        return [instrument];
      }
    }

    // Try category-based fallback - find instruments in the same category
    const category = this.extractCategoryFromId(missingInstrumentId);
    if (category) {
      const categoryInstruments =
        this.instrumentCatalog.getInstrumentsByCategory(category);
      if (categoryInstruments.length > 0) {
        return categoryInstruments.slice(0, 1); // Return first available
      }
    }

    // Last resort: find any available instrument
    if (catalog.instruments.length > 0) {
      return [catalog.instruments[0]!];
    }

    return [];
  }

  /**
   * Find an alternative instrument that doesn't exceed polyphony limits
   */
  private findAlternativeForPolyphony(
    currentInstrumentId: string,
    polyphonyUsage: Map<string, number>
  ): Instrument | null {
    const currentInstrument =
      this.instrumentCatalog.getInstrument(currentInstrumentId);
    if (!currentInstrument) return null;

    // Try fallbacks of the current instrument
    const fallbacks =
      this.instrumentCatalog.getFallbackInstruments(currentInstrumentId);
    for (const fallback of fallbacks) {
      const currentUsage = polyphonyUsage.get(fallback.id) || 0;
      if (currentUsage < (fallback.polyphony_limit || Infinity)) {
        return fallback;
      }
    }

    // Try instruments in the same category
    const categoryInstruments = this.instrumentCatalog.getInstrumentsByCategory(
      currentInstrument.category
    );
    for (const instrument of categoryInstruments) {
      if (instrument.id !== currentInstrumentId) {
        const currentUsage = polyphonyUsage.get(instrument.id) || 0;
        if (currentUsage < (instrument.polyphony_limit || Infinity)) {
          return instrument;
        }
      }
    }

    return null;
  }

  /**
   * Extract category from instrument ID (simple heuristic)
   */
  private extractCategoryFromId(instrumentId: string): string | null {
    // Simple pattern: category_instrumentname
    const parts = instrumentId.split('_');
    if (parts.length >= 2) {
      return parts[0] as string;
    }
    return null;
  }

  /**
   * Generate a minimal valid WAV file with 1 second of silence
   */
  private generateWavPlaceholder(): Buffer {
    const sampleRate = 44100;
    const channels = 2;
    const bitsPerSample = 16;
    const duration = 1; // 1 second
    const numSamples = sampleRate * duration;
    const dataSize = numSamples * channels * (bitsPerSample / 8);
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // PCM format
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
    buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Audio data (silence)
    // All zeros for silence

    return buffer;
  }

  /**
   * Validate export options
   */
  validateOptions(options: StemExportOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!options.format || !['wav', 'mp3'].includes(options.format)) {
      errors.push('Format must be wav or mp3');
    }

    if (
      !options.instruments ||
      !Array.isArray(options.instruments) ||
      options.instruments.length === 0
    ) {
      errors.push('At least one instrument must be specified');
    } else {
      // Validate instrument IDs against catalog (with fallbacks enabled)
      const instrumentValidation = this.instrumentCatalog.validateInstrumentIds(
        options.instruments
      );

      // If fallbacks are disabled and there are invalid instruments, that's an error
      // If fallbacks are enabled, we'll resolve them during export
      if (!options.useFallbacks && !instrumentValidation.valid) {
        errors.push(...instrumentValidation.errors);
      }
      // Note: When fallbacks are enabled, we allow invalid instruments to be resolved later
    }

    if (!options.outputDir || typeof options.outputDir !== 'string') {
      errors.push('Output directory must be specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
