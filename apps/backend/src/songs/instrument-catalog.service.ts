import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { Observable } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import Ajv from 'ajv';

export interface InstrumentCatalog {
  version: string;
  generated_at: string;
  description: string;
  categories: string[];
  instruments: Instrument[];
}

export interface Instrument {
  id: string;
  name: string;
  category: string;
  presets: string[];
  fallback_rules?: string[];
  sample_references?: string[];
  polyphony_limit?: number;
  range?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class InstrumentCatalogService implements OnModuleInit {
  private readonly logger = new Logger(InstrumentCatalogService.name);
  private ajv: Ajv;
  private schema: any;
  private catalog: InstrumentCatalog | null = null;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }

  async onModuleInit() {
    // Load the instrument catalog during module initialization
    this.loadCatalog().subscribe({
      next: (result) => {
        if (!result.valid) {
          this.logger.error(
            `Failed to load instrument catalog: ${result.errors.join(', ')}`
          );
        } else {
          this.logger.log('Instrument catalog loaded successfully');
        }
      },
      error: (error) => {
        this.logger.error(`Error loading instrument catalog: ${error.message}`);
      },
    });
  }

  /**
   * Load and validate the instrument catalog
   */
  loadCatalog(catalogPath?: string): Observable<ValidationResult> {
    const catalogFile =
      catalogPath ||
      path.join(process.cwd(), 'models', 'instrument_catalog.json');
    const schemaFile = path.join(
      process.cwd(),
      'models',
      'instrument_catalog.schema.json'
    );

    // Create observables for file reading
    const readFileObservable = (filePath: string) => {
      return new Observable<string>((observer) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next(data);
            observer.complete();
          }
        });
      });
    };

    // Chain the file reading operations reactively
    return readFileObservable(schemaFile).pipe(
      map((schemaContent) => {
        this.schema = JSON.parse(schemaContent);
        return this.schema;
      }),
      switchMap(() => readFileObservable(catalogFile)),
      map((catalogContent) => {
        const catalogData: InstrumentCatalog = JSON.parse(catalogContent);
        const validate = this.ajv.compile(this.schema);
        const valid = validate(catalogData);

        if (!valid) {
          const errors = validate.errors?.map((err: any) => {
            const field = err.instancePath || 'root';
            return `${field}: ${err.message}`;
          }) || ['Unknown validation error'];

          this.logger.error(
            `Instrument catalog validation failed: ${errors.join(', ')}`
          );
          return { valid: false, errors };
        }

        // Additional semantic validation
        const semanticErrors = this.validateSemantics(catalogData);
        if (semanticErrors.length > 0) {
          this.logger.error(
            `Instrument catalog semantic validation failed: ${semanticErrors.join(
              ', '
            )}`
          );
          return { valid: false, errors: semanticErrors };
        }

        this.catalog = catalogData;
        this.logger.log(
          `Successfully loaded instrument catalog v${catalogData.version} with ${catalogData.instruments.length} instruments`
        );
        return { valid: true, errors: [] };
      }),
      catchError((error) => {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to load instrument catalog: ${errorMsg}`);
        return [{ valid: false, errors: [errorMsg] }];
      })
    );
  }

  /**
   * Get the loaded instrument catalog
   */
  getCatalog(): InstrumentCatalog | null {
    return this.catalog;
  }

  /**
   * Find an instrument by ID
   */
  getInstrument(instrumentId: string): Instrument | null {
    if (!this.catalog) return null;
    return (
      this.catalog.instruments.find((inst) => inst.id === instrumentId) || null
    );
  }

  /**
   * Get all instruments in a category
   */
  getInstrumentsByCategory(category: string): Instrument[] {
    if (!this.catalog) return [];
    return this.catalog.instruments.filter(
      (inst) => inst.category === category
    );
  }

  /**
   * Get fallback instruments for a given instrument
   */
  getFallbackInstruments(instrumentId: string): Instrument[] {
    const instrument = this.getInstrument(instrumentId);
    if (!instrument || !instrument.fallback_rules) return [];

    return instrument.fallback_rules
      .map((id) => this.getInstrument(id))
      .filter((inst): inst is Instrument => inst !== null);
  }

  /**
   * Validate instrument IDs exist in the catalog
   */
  validateInstrumentIds(instrumentIds: string[]): ValidationResult {
    if (!this.catalog) {
      return { valid: false, errors: ['Instrument catalog not loaded'] };
    }

    const errors: string[] = [];
    const validIds = new Set(this.catalog.instruments.map((inst) => inst.id));

    for (const id of instrumentIds) {
      if (!validIds.has(id)) {
        errors.push(`Unknown instrument ID: ${id}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform semantic validation beyond JSON schema
   */
  private validateSemantics(catalog: any): string[] {
    const errors: string[] = [];

    // Check that all fallback rules reference existing instruments
    const instrumentIds = new Set(
      catalog.instruments.map((inst: any) => inst.id)
    );

    for (const instrument of catalog.instruments) {
      if (instrument.fallback_rules) {
        for (const fallbackId of instrument.fallback_rules) {
          if (!instrumentIds.has(fallbackId)) {
            errors.push(
              `Instrument ${instrument.id} has invalid fallback rule: ${fallbackId}`
            );
          }
        }
      }

      // Check that category exists in categories array
      if (!catalog.categories.includes(instrument.category)) {
        errors.push(
          `Instrument ${instrument.id} has unknown category: ${instrument.category}`
        );
      }
    }

    // Check for duplicate instrument IDs
    const seenIds = new Set<string>();
    for (const instrument of catalog.instruments) {
      if (seenIds.has(instrument.id)) {
        errors.push(`Duplicate instrument ID: ${instrument.id}`);
      }
      seenIds.add(instrument.id);
    }

    return errors;
  }
}
