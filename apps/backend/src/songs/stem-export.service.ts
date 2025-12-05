import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap, mergeMap, toArray } from 'rxjs/operators';
import { InstrumentCatalogService } from './instrument-catalog.service';

export interface StemExportOptions {
  format: 'wav' | 'mp3';
  instruments: string[];
  outputDir: string;
  sampleRate?: number;
}

export interface StemExportResult {
  success: boolean;
  stems: Array<{
    instrument: string;
    filePath: string;
    format: string;
    size: number;
  }>;
  errors: string[];
}

@Injectable()
export class StemExportService {
  constructor(private readonly instrumentCatalog: InstrumentCatalogService) {}
  /**
   * Export per-instrument stems in the specified format
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
        // Process each instrument reactively
        const instrumentObservables = options.instruments.map(
          (instrument) => {
            const fileName = `${instrument.replace(/[^a-zA-Z0-9]/g, '_')}.${
              options.format
            }`;
            const filePath = path.join(options.outputDir, fileName);
            const audioData = this.generatePlaceholderAudio(
              instrument,
              options.format
            );

            return writeFileObservable(filePath, audioData).pipe(
              switchMap(() => statObservable(filePath)),
              map((stats) => ({
                instrument,
                filePath,
                format: options.format,
                size: stats.size,
              })),
              catchError((error) => {
                const errorMsg = `Failed to export stem for ${instrument}: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`;
                return [{ error: errorMsg }];
              })
            );
          }
        );

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
        }>;
        const errors = results
          .filter((result) => 'error' in result)
          .map((result) => (result as any).error);

        const result: StemExportResult = {
          success: errors.length === 0,
          stems,
          errors,
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
        };
        return from(Promise.resolve(result));
      })
    );
  }
  /**
   * Generate placeholder audio data
   * This creates a minimal valid WAV file with silence
   * In production, replace with actual audio synthesis
   */
  private generatePlaceholderAudio(
    instrument: string,
    format: 'wav' | 'mp3'
  ): Buffer {
    if (format === 'wav') {
      return this.generateWavPlaceholder();
    } else {
      // For MP3, we'd need an encoder, but for now return a placeholder
      return Buffer.from(`Placeholder MP3 data for ${instrument}`, 'utf8');
    }
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
      // Validate instrument IDs against catalog
      const instrumentValidation = this.instrumentCatalog.validateInstrumentIds(
        options.instruments
      );
      if (!instrumentValidation.valid) {
        errors.push(...instrumentValidation.errors);
      }
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
