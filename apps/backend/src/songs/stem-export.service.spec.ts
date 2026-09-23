import { StemExportService } from './stem-export.service';

describe('StemExportService output path validation', () => {
  const instrumentCatalog = {
    validateInstrumentIds: jest.fn(() => ({ valid: true, errors: [] })),
  } as any;
  const musicRuntime = {} as any;
  const service = new StemExportService(instrumentCatalog, musicRuntime);

  it.each([
    'generated/smoke',
    'generated',
    'exports/smoke',
    'exports',
  ])('allows app-owned output directory %s', (outputDir) => {
    expect(
      service.validateOptions({
        format: 'wav',
        instruments: ['piano'],
        outputDir,
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it.each([
    '../outside',
    '.',
    'logs/stems',
  ])('rejects output directory outside generated/ and exports/: %s', (outputDir) => {
    const result = service.validateOptions({
      format: 'wav',
      instruments: ['piano'],
      outputDir,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Output directory must be inside Harmonia generated/ or exports/.'
    );
  });
});
