import { Test, TestingModule } from '@nestjs/testing';
import { InstrumentCatalogService } from './instrument-catalog.service';
import { firstValueFrom } from 'rxjs';

describe('InstrumentCatalogService', () => {
  let service: InstrumentCatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InstrumentCatalogService],
    }).compile();

    service = module.get<InstrumentCatalogService>(InstrumentCatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate instrument catalog', async () => {
    const result = await firstValueFrom(service.loadCatalog());
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);

    const catalog = service.getCatalog();
    expect(catalog).toBeDefined();
    expect(catalog?.version).toBe('1.0.0');
    expect(catalog?.instruments).toBeDefined();
    expect(catalog?.instruments.length).toBeGreaterThan(0);
  });

  it('should validate instrument IDs', async () => {
    await firstValueFrom(service.loadCatalog()); // Load catalog first

    const validResult = service.validateInstrumentIds([
      'violin',
      'guitar_acoustic',
    ]);
    expect(validResult.valid).toBe(true);

    const invalidResult = service.validateInstrumentIds([
      'violin',
      'nonexistent_instrument',
    ]);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toContain(
      'Unknown instrument ID: nonexistent_instrument'
    );
  });

  it('should get instruments by category', async () => {
    await firstValueFrom(service.loadCatalog());

    const strings = service.getInstrumentsByCategory('strings');
    expect(strings.length).toBeGreaterThan(0);
    expect(strings.every((inst) => inst.category === 'strings')).toBe(true);
  });

  it('should get fallback instruments', async () => {
    await firstValueFrom(service.loadCatalog());

    const fallbacks = service.getFallbackInstruments('violin');
    expect(Array.isArray(fallbacks)).toBe(true);
  });
});
