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
        const instrumentObservables = options.instruments.map((instrument) => {
          const fileName = `${instrument.replace(/[^a-zA-Z0-9]/g, '_')}.${
            options.format
          }`;
          const filePath = path.join(options.outputDir, fileName);

          // Generate real provider audio. Provider failures propagate and are
          // reported to the caller; Harmonia must never substitute fake audio.
          const audioObservable = from(
            this.generateMusicGenAudio(instrument)
          );

          return audioObservable.pipe(
            switchMap((audioData) => writeFileObservable(filePath, audioData)),
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
              return from([{ error: errorMsg }]);
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
   * Generate audio using MusicGen via Docker
   */
  private generateMusicGenAudio(instrument: string): Promise<Buffer> {
    // Call the MusicGen Docker container to generate real audio
    console.log(
      `Generating audio for ${instrument} using MusicGen Docker container...`
    );

    const { spawn } = require('child_process');
    const outputPath = `/tmp/${instrument.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
    const debugLogPath = path.join(
      process.cwd(),
      'logs',
      `musicgen_${instrument}_${Date.now()}.log`
    );

    // Ensure logs directory exists
    const logsDir = path.dirname(debugLogPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    return new Promise<Buffer>((resolve, reject) => {
      // Run the Python script in the Docker container
      const dockerCmd = spawn(
        'docker',
        [
          'exec',
          'harmonia-musicgen',
          'python3',
          '/workspace/scripts/generate_musicgen_audio.py',
          '--instrument',
          instrument,
          '--output',
          outputPath,
          '--duration',
          '5',
        ],
        { stdio: 'pipe' }
      );

      let stdout = '';
      let stderr = '';

      dockerCmd.stdout.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        stdout += dataStr;
        console.log(`MusicGen stdout: ${dataStr.trim()}`);

        // Write to debug log file
        fs.appendFileSync(
          debugLogPath,
          `[${new Date().toISOString()}] STDOUT: ${dataStr}`
        );
      });

      dockerCmd.stderr.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        stderr += dataStr;
        console.error(`MusicGen stderr: ${dataStr.trim()}`);

        // Write to debug log file
        fs.appendFileSync(
          debugLogPath,
          `[${new Date().toISOString()}] STDERR: ${dataStr}`
        );
      });

      dockerCmd.on('close', (code: number | null) => {
        const logMessage = `[${new Date().toISOString()}] PROCESS EXIT: code=${code}\n`;
        fs.appendFileSync(debugLogPath, logMessage);
        console.log(`MusicGen process exited with code: ${code}`);

        if (code === 0) {
          console.log(`MusicGen generation successful for ${instrument}`);
          // Read the generated file from the container
          const { spawn: spawn2 } = require('child_process');
          const catCmd = spawn2(
            'docker',
            ['exec', 'harmonia-musicgen', 'cat', outputPath],
            { stdio: 'pipe' }
          );

          let audioBuffer = Buffer.alloc(0);
          catCmd.stdout.on('data', (data: Buffer) => {
            audioBuffer = Buffer.concat([audioBuffer, data]);
          });

          catCmd.on('close', (catCode: number | null) => {
            const catLogMessage = `[${new Date().toISOString()}] CAT EXIT: code=${catCode}, buffer_size=${
              audioBuffer.length
            }\n`;
            fs.appendFileSync(debugLogPath, catLogMessage);

            if (catCode === 0 && audioBuffer.length > 0) {
              console.log(
                `Successfully read ${audioBuffer.length} bytes of audio data for ${instrument}`
              );
              resolve(audioBuffer);
            } else {
              const errorMsg = `Failed to read generated audio file (cat exit code: ${catCode}, buffer size: ${audioBuffer.length})`;
              console.error(errorMsg);
              fs.appendFileSync(
                debugLogPath,
                `[${new Date().toISOString()}] ERROR: ${errorMsg}\n`
              );
              reject(new Error(errorMsg));
            }
          });

          catCmd.stderr.on('data', (data: Buffer) => {
            const errorData = data.toString();
            console.error(`Cat stderr: ${errorData}`);
            fs.appendFileSync(
              debugLogPath,
              `[${new Date().toISOString()}] CAT STDERR: ${errorData}`
            );
          });
        } else {
          const errorMsg = `MusicGen generation failed with code ${code}`;
          console.error(`${errorMsg}. Stderr: ${stderr}`);
          fs.appendFileSync(
            debugLogPath,
            `[${new Date().toISOString()}] ERROR: ${errorMsg}\nSTDERR: ${stderr}\n`
          );
          reject(new Error(`${errorMsg}: ${stderr.trim() || 'no stderr'}`));
        }
      });

      dockerCmd.on('error', (error: Error) => {
        const errorMsg = `Failed to start MusicGen Docker command: ${error.message}`;
        console.error(errorMsg);
        fs.appendFileSync(
          debugLogPath,
          `[${new Date().toISOString()}] FATAL ERROR: ${errorMsg}\n`
        );
        reject(new Error(errorMsg));
      });

      // Log the command being executed
      const cmdLogMessage = `[${new Date().toISOString()}] EXECUTING: docker exec harmonia-musicgen python3 /workspace/scripts/generate_musicgen_audio.py --instrument ${instrument} --output ${outputPath} --duration 5\n`;
      fs.appendFileSync(debugLogPath, cmdLogMessage);
    });
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
