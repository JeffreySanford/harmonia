#!/usr/bin/env node

/**
 * Harmonia Demo CLI
 *
 * End-to-end music generation pipeline using hot observables:
 * DSL → Internal Representation → events.json → WAV stems
 *
 * Usage:
 *   npm run demo:cli -- --input "path/to/song.mmsl" --output "output/dir"
 *   npm run demo:cli -- --dsl "inline DSL content" --output "output/dir"
 *   npm run demo:cli -- --help
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import {
  Observable,
  of,
  from,
  shareReplay,
  tap,
  map,
  switchMap,
  catchError,
} from 'rxjs';
import { SongDslParserService } from '../apps/backend/src/songs/song-dsl-parser.service';
import { StemExportService } from '../apps/backend/src/songs/stem-export.service';
import { InstrumentCatalogService } from '../apps/backend/src/songs/instrument-catalog.service';

interface DemoOptions {
  input?: string;
  dsl?: string;
  output: string;
  format?: 'wav' | 'mp3';
  validateOnly?: boolean;
  verbose?: boolean;
}

interface PipelineResult {
  success: boolean;
  stages: {
    dsl: { success: boolean; data?: any; errors?: string[] };
    ir: { success: boolean; data?: any; errors?: string[] };
    events: { success: boolean; data?: any; errors?: string[] };
    stems: { success: boolean; data?: any; errors?: string[] };
  };
  outputFiles?: string[];
  duration: number;
}

class HarmoniaDemoCLI {
  private dslParser: SongDslParserService;
  private stemExporter: StemExportService;
  private instrumentCatalog: InstrumentCatalogService;

  constructor() {
    // Initialize services
    this.dslParser = new SongDslParserService();
    this.instrumentCatalog = new InstrumentCatalogService();
    this.stemExporter = new StemExportService(this.instrumentCatalog);
  }

  async run(): Promise<void> {
    const program = new Command();

    program
      .name('harmonia-demo')
      .description('Harmonia Music Generation Demo CLI')
      .version('1.0.0')
      .requiredOption(
        '-o, --output <directory>',
        'Output directory for generated files'
      )
      .option('-i, --input <file>', 'Input M-MSL DSL file path')
      .option('-d, --dsl <content>', 'Inline M-MSL DSL content')
      .option('-f, --format <format>', 'Audio format (wav or mp3)', 'wav')
      .option('--validate-only', 'Only validate DSL without generating audio')
      .option('-v, --verbose', 'Verbose output')
      .option('--help', 'Display help information');

    program.parse();

    const options = program.opts<DemoOptions>();

    if (!options.input && !options.dsl) {
      console.error(
        '❌ Error: Must provide either --input file or --dsl content'
      );
      console.log('\nExamples:');
      console.log(
        '  npm run demo:cli -- --input "songs/example.mmsl" --output "demo-output"'
      );
      console.log(
        '  npm run demo:cli -- --dsl "[Verse] (piano) C4 D4 E4" --output "demo-output"'
      );
      process.exit(1);
    }

    if (options.input && options.dsl) {
      console.error('❌ Error: Cannot specify both --input and --dsl');
      process.exit(1);
    }

    console.log(
      '🎵 Harmonia Demo CLI - Music Generation Pipeline (Hot Observables)'
    );
    console.log(
      '=================================================================\n'
    );

    const startTime = Date.now();

    // Create hot observable pipeline
    const pipeline$ = this.createPipelineObservable(options).pipe(
      shareReplay(1) // Make it hot - starts immediately, can be subscribed to multiple times
    );

    // Subscribe to the pipeline and handle results
    pipeline$.subscribe({
      next: (result) => {
        const duration = Date.now() - startTime;
        this.displayResults(result, duration, options);

        if (result.success) {
          console.log('\n🎉 Demo completed successfully!');
          console.log(`📁 Output directory: ${path.resolve(options.output)}`);
          if (result.outputFiles && result.outputFiles.length > 0) {
            console.log('📄 Generated files:');
            result.outputFiles.forEach((file) => console.log(`  - ${file}`));
          }
          process.exit(0);
        } else {
          console.error('\n❌ Demo failed!');
          process.exit(1);
        }
      },
      error: (error) => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
      },
    });
  }

  private createPipelineObservable(
    options: DemoOptions
  ): Observable<PipelineResult> {
    return of(options).pipe(
      // Stage 0: Load instrument catalog
      tap(() => console.log('📚 Loading instrument catalog...')),
      switchMap(() => this.instrumentCatalog.loadCatalog()),
      tap((catalogResult) => {
        if (!catalogResult.valid) {
          console.error('❌ Failed to load instrument catalog:');
          catalogResult.errors.forEach((error) =>
            console.error(`  - ${error}`)
          );
          throw new Error('Instrument catalog loading failed');
        }
        console.log('✅ Instrument catalog loaded\n');
      }),

      // Stage 1: Read DSL content
      switchMap(() => this.readDslContent(options)),
      tap(({ dslContent }) => {
        if (options.verbose) {
          console.log('\n--- DSL Content ---');
          console.log(dslContent);
          console.log('-------------------\n');
        }
      }),

      // Stage 2: Parse DSL and convert to IR
      tap(() => console.log('🔍 Stage 1: Parsing M-MSL DSL...')),
      map(({ dslContent }) => {
        const dslResult = this.dslParser.parseSong(dslContent);
        const success =
          dslResult.errors.filter((e) => e.severity === 'error').length === 0;

        if (!success) {
          console.error('❌ DSL parsing failed:');
          dslResult.errors.forEach((error) =>
            console.error(`  - ${error.message}`)
          );
        } else {
          console.log('✅ DSL parsed successfully');
          if (options.verbose) {
            console.log(
              `   - Sections: ${dslResult.song.sections?.length || 0}`
            );
            console.log(`   - Title: ${dslResult.song.title || 'Untitled'}`);
          }
        }

        // Stage 3: Convert to Internal Representation
        console.log('\n🔄 Stage 2: Converting to Internal Representation...');
        const irResult = this.convertToInternalRepresentation(dslResult.song);

        console.log('✅ Internal representation created');
        if (options.verbose) {
          console.log(`   - Events: ${irResult.events?.length || 0}`);
          console.log(`   - Duration: ${irResult.totalDuration || 0}s`);
        }

        return {
          dslResult,
          irResult,
          success,
          options,
        };
      }),

      // Stage 4: Generate events.json and export stems
      switchMap(({ dslResult, irResult, success, options }) => {
        if (!success) {
          return of({
            success: false,
            stages: {
              dsl: { success: false, errors: ['DSL parsing failed'] },
              ir: { success: false },
              events: { success: false },
              stems: { success: false },
            },
            duration: 0,
          });
        }

        console.log('\n📄 Stage 3: Generating events.json...');
        return from(this.generateEventsJson(irResult, options)).pipe(
          switchMap((eventsResult) => {
            if (!eventsResult.success) {
              console.error('❌ Events generation failed:');
              eventsResult.errors?.forEach((error) =>
                console.error(`  - ${error}`)
              );
              return of({
                success: false,
                stages: {
                  dsl: { success: true, data: dslResult },
                  ir: { success: true, data: irResult },
                  events: { success: false, errors: eventsResult.errors },
                  stems: { success: false },
                },
                duration: 0,
              });
            }

            console.log('✅ Events.json generated');

            // Stage 5: Export stems (unless validate-only)
            if (options.validateOnly) {
              return of({
                success: true,
                stages: {
                  dsl: { success: true, data: dslResult },
                  ir: { success: true, data: irResult },
                  events: { success: true, data: eventsResult.data },
                  stems: { success: true },
                },
                duration: 0,
              });
            }

            console.log('\n🎵 Stage 4: Exporting audio stems...');

            // Extract unique instruments from IR
            const instruments = Array.from(
              new Set(
                irResult.events?.map((e: any) => e.instrument).filter(Boolean)
              )
            ) as string[];

            return from(
              this.stemExporter.exportStems({
                format: options.format as 'wav' | 'mp3',
                instruments,
                outputDir: options.output,
                sampleRate: 44100,
              })
            ).pipe(
              map((stemsResult) => {
                if (!stemsResult.success) {
                  console.error('❌ Stem export failed:');
                  stemsResult.errors?.forEach((error) =>
                    console.error(`  - ${error}`)
                  );
                  return {
                    success: false,
                    stages: {
                      dsl: { success: true, data: dslResult },
                      ir: { success: true, data: irResult },
                      events: { success: true, data: eventsResult.data },
                      stems: { success: false, errors: stemsResult.errors },
                    },
                    duration: 0,
                  };
                }

                console.log('✅ Audio stems exported');

                return {
                  success: true,
                  stages: {
                    dsl: { success: true, data: dslResult },
                    ir: { success: true, data: irResult },
                    events: { success: true, data: eventsResult.data },
                    stems: { success: true, data: stemsResult },
                  },
                  outputFiles: stemsResult.stems.map((s) => s.filePath),
                  duration: 0,
                };
              })
            );
          })
        );
      }),

      catchError((error) => {
        console.error('💥 Pipeline error:', error.message);
        return of({
          success: false,
          stages: {
            dsl: { success: false, errors: [error.message] },
            ir: { success: false },
            events: { success: false },
            stems: { success: false },
          },
          duration: 0,
        });
      })
    );
  }

  private readDslContent(
    options: DemoOptions
  ): Observable<{ dslContent: string; options: DemoOptions }> {
    if (options.input) {
      console.log(`📖 Reading DSL from file: ${options.input}`);
      return from(fs.readFile(options.input, 'utf8')).pipe(
        map((content) => ({ dslContent: content, options }))
      );
    } else {
      console.log('📝 Using inline DSL content');
      return of({ dslContent: options.dsl!, options });
    }
  }

  private convertToInternalRepresentation(dslResult: any): any {
    // Convert parsed DSL to internal representation
    // This is a simplified conversion - in production this would be more sophisticated
    const ir = {
      metadata: {
        title: dslResult.title || 'Generated Song',
        tempo: dslResult.tempo || 120,
        key: dslResult.key || 'C',
        timeSignature: dslResult.timeSignature || '4/4',
      },
      events: [] as any[],
      totalDuration: 0,
    };

    let currentTime = 0;

    // Convert sections to events
    if (dslResult.sections) {
      for (const section of dslResult.sections) {
        if (section.instruments) {
          for (const instrument of section.instruments) {
            // Create events for this instrument in this section
            const events = this.generateEventsForInstrument(
              instrument,
              section,
              currentTime
            );
            ir.events.push(...events);
          }
        }
        currentTime += section.duration || 4; // Default 4 beats per section
      }
    }

    ir.totalDuration = currentTime;
    return ir;
  }

  private generateEventsForInstrument(
    instrument: any,
    section: any,
    startTime: number
  ): any[] {
    const events = [];
    const duration = section.duration || 4;

    // Generate basic note events (simplified)
    // In production, this would use more sophisticated music generation logic
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];

    for (let beat = 0; beat < duration; beat++) {
      const note = notes[Math.floor(Math.random() * notes.length)];
      events.push({
        instrument: instrument.name || instrument.id,
        note,
        startTime: startTime + beat,
        duration: 0.5, // Half note
        velocity: 80,
      });
    }

    return events;
  }

  private async generateEventsJson(
    ir: any,
    options: DemoOptions
  ): Promise<{ success: boolean; data?: any; errors?: string[] }> {
    try {
      const eventsPath = path.join(options.output, 'events.json');

      // Ensure output directory exists
      await fs.mkdir(options.output, { recursive: true });

      // Write events.json
      await fs.writeFile(eventsPath, JSON.stringify(ir, null, 2), 'utf8');

      return { success: true, data: { path: eventsPath } };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Failed to generate events.json: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        ],
      };
    }
  }

  private displayResults(
    result: PipelineResult,
    duration: number,
    options: DemoOptions
  ): void {
    console.log('\n📊 Pipeline Results');
    console.log('==================');

    const stages = [
      { name: 'DSL Parsing', key: 'dsl' as keyof PipelineResult['stages'] },
      { name: 'IR Conversion', key: 'ir' as keyof PipelineResult['stages'] },
      {
        name: 'Events Generation',
        key: 'events' as keyof PipelineResult['stages'],
      },
      { name: 'Stem Export', key: 'stems' as keyof PipelineResult['stages'] },
    ];

    for (const stage of stages) {
      const stageResult = result.stages[stage.key];
      const status = stageResult.success ? '✅' : '❌';
      console.log(
        `${status} ${stage.name}: ${stageResult.success ? 'Success' : 'Failed'}`
      );

      if (!stageResult.success && stageResult.errors && options.verbose) {
        stageResult.errors.forEach((error) => console.log(`   - ${error}`));
      }
    }

    console.log(`\n⏱️  Total duration: ${(duration / 1000).toFixed(2)}s`);

    if (result.success) {
      console.log('\n📈 Summary:');
      if (result.stages.ir.data) {
        console.log(
          `   - Song title: ${
            result.stages.ir.data.metadata?.title || 'Unknown'
          }`
        );
        console.log(
          `   - Total events: ${result.stages.ir.data.events?.length || 0}`
        );
        console.log(
          `   - Duration: ${result.stages.ir.data.totalDuration || 0}s`
        );
      }
      if (result.outputFiles) {
        console.log(`   - Audio files: ${result.outputFiles.length}`);
      }
    }
  }
}

// Run the CLI
const cli = new HarmoniaDemoCLI();
cli.run().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
