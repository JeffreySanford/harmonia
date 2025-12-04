import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
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
export class InstrumentCatalogService {
  private readonly logger = new Logger(InstrumentCatalogService.name);
  private ajv: Ajv;
  private schema: any;
  private catalog: InstrumentCatalog | null = null;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }

  /**
   * Load and validate the instrument catalog
   */
  async loadCatalog(catalogPath?: string): Promise<ValidationResult> {
    const catalogFile = catalogPath || path.join(process.cwd(), 'models', 'instrument_catalog.json');
    const schemaFile = path.join(process.cwd(), 'models', 'instrument_catalog.schema.json');

    try {
      // Load schema
      const schemaContent = await fs.readFile(schemaFile, 'utf8');
      this.schema = JSON.parse(schemaContent);
      const validate = this.ajv.compile(this.schema);

      // Load catalog
      const catalogContent = await fs.readFile(catalogFile, 'utf8');
      const catalogData: InstrumentCatalog = JSON.parse(catalogContent);

      // Validate against schema
      const valid = validate(catalogData);

      if (!valid) {
        const errors = validate.errors?.map((err: any) => {
          const field = err.instancePath || 'root';
          return `${field}: ${err.message}`;
        }) || ['Unknown validation error'];

        this.logger.error(`Instrument catalog validation failed: ${errors.join(', ')}`);
        return { valid: false, errors };
      }

      // Additional semantic validation
      const semanticErrors = this.validateSemantics(catalogData);
      if (semanticErrors.length > 0) {
        this.logger.error(`Instrument catalog semantic validation failed: ${semanticErrors.join(', ')}`);
        return { valid: false, errors: semanticErrors };
      }

      this.catalog = catalogData;
      this.logger.log(`Successfully loaded instrument catalog v${catalogData.version} with ${catalogData.instruments.length} instruments`);
      return { valid: true, errors: [] };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to load instrument catalog: ${errorMsg}`);
      return { valid: false, errors: [errorMsg] };
    }
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
    return this.catalog.instruments.find(inst => inst.id === instrumentId) || null;
  }

  /**
   * Get all instruments in a category
   */
  getInstrumentsByCategory(category: string): Instrument[] {
    if (!this.catalog) return [];
    return this.catalog.instruments.filter(inst => inst.category === category);
  }

  /**
   * Get fallback instruments for a given instrument
   */
  getFallbackInstruments(instrumentId: string): Instrument[] {
    const instrument = this.getInstrument(instrumentId);
    if (!instrument || !instrument.fallback_rules) return [];

    return instrument.fallback_rules
      .map(id => this.getInstrument(id))
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
    const validIds = new Set(this.catalog.instruments.map(inst => inst.id));

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
    const instrumentIds = new Set(catalog.instruments.map((inst: any) => inst.id));

    for (const instrument of catalog.instruments) {
      if (instrument.fallback_rules) {
        for (const fallbackId of instrument.fallback_rules) {
          if (!instrumentIds.has(fallbackId)) {
            errors.push(`Instrument ${instrument.id} has invalid fallback rule: ${fallbackId}`);
          }
        }
      }

      // Check that category exists in categories array
      if (!catalog.categories.includes(instrument.category)) {
        errors.push(`Instrument ${instrument.id} has unknown category: ${instrument.category}`);
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