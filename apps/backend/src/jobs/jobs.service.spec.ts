import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { JobsService } from './jobs.service';

describe('JobsService generation contract', () => {
  const service = new JobsService(
    {} as any,
    {} as any,
    {} as any
  );

  function validGenerate(overrides: Record<string, unknown> = {}) {
    return {
      jobType: 'generate' as const,
      modelId: 'musicgen-small',
      parameters: {
        duration: 5,
        genre: 'rock',
        mood: 'energetic',
        bpm: 120,
        instruments: ['guitar_electric', 'drums'],
        ...overrides,
      },
    };
  }

  it('accepts a real MusicGen generation request', () => {
    expect(() =>
      (service as any).validateGenerationRequest(validGenerate())
    ).not.toThrow();
  });

  it('accepts ACE-Step generation with supplied lyrics at 30 seconds', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'acestep-v15-turbo-06b',
        parameters: {
          title: 'Phase 12D',
          prompt:
            'uplifting alternative rock with electric guitar and steady drums',
          lyrics:
            '[Verse]\nRunning north beneath the open sky\n[Chorus]\nTrue north keeps us moving',
          duration: 30,
          bpm: 118,
        },
      })
    ).not.toThrow();
  });

  it('rejects ACE-Step generation without supplied lyrics', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'acestep-v15-turbo-06b',
        parameters: {
          prompt: 'alternative rock',
          duration: 30,
          bpm: 118,
        },
      })
    ).toThrow(
      'ACE-Step generation requires supplied lyrics.'
    );
  });

  it('enforces the ACE-Step 10 second upstream minimum duration', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'acestep-v15-turbo-06b',
        parameters: {
          prompt: 'alternative rock',
          lyrics: 'Keep moving forward',
          duration: 9,
        },
      })
    ).toThrow(
      'Generation duration must be at least 10 seconds.'
    );
  });

  it('accepts DiffRhythm Base generation with prompt, lyrics, and exact 95-second duration', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          title: 'DiffRhythm E3',
          prompt:
            'cinematic electronic rock with wide stereo production',
          lyrics:
            '[00:00.00] Northern lights above the plain\\n[00:48.00] Carry the rhythm home again',
          duration: 95,
          seed: 1604,
        },
      })
    ).not.toThrow();
  });

  it('accepts DiffRhythm Base generation without an explicit seed', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'atmospheric synth rock',
          lyrics:
            '[00:00.00] Midnight current on the line',
          duration: 95,
        },
      })
    ).not.toThrow();
  });

  it('rejects DiffRhythm generation without supplied lyrics', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'cinematic electronic rock',
          duration: 95,
        },
      })
    ).toThrow(
      'DiffRhythm generation requires supplied lyrics.'
    );
  });

  it('rejects DiffRhythm Base generation unless duration is exactly 95 seconds', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'cinematic electronic rock',
          lyrics:
            '[00:00.00] Northern lights',
          duration: 94,
        },
      })
    ).toThrow(
      'DiffRhythm v1.2 Base generation requires exactly 95 seconds.'
    );
  });

  it('rejects an invalid DiffRhythm seed', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        modelId: 'diffrhythm-v12-base',
        parameters: {
          prompt: 'cinematic electronic rock',
          lyrics:
            '[00:00.00] Northern lights',
          duration: 95,
          seed: -1,
        },
      })
    ).toThrow(
      'DiffRhythm seed must be a non-negative integer.'
    );
  });

  it('rejects generation without a model', () => {
    expect(() =>
      (service as any).validateGenerationRequest({
        jobType: 'generate',
        parameters: { duration: 5, prompt: 'ambient piano' },
      })
    ).toThrow(BadRequestException);
  });

  it('rejects generation beyond the selected model duration', () => {
    expect(() =>
      (service as any).validateGenerationRequest(
        validGenerate({ duration: 121 })
      )
    ).toThrow('MusicGen Small supports at most 120 seconds.');
  });

  it('builds a descriptive prompt from generation parameters', () => {
    expect(
      (service as any).buildGenerationPrompt(
        validGenerate().parameters
      )
    ).toBe(
      'rock music, energetic mood, 120 BPM, featuring guitar electric, drums'
    );
  });

  it('rejects an artifact that is not a WAV file', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'harmonia-job-test-')
    );
    const filePath = path.join(tempDir, 'fake.wav');
    await fs.writeFile(filePath, Buffer.from('not audio'));

    await expect(
      (service as any).validateWav(filePath, 5)
    ).rejects.toThrow('too small to be a valid WAV');

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('validates PCM WAV metadata and requested duration', async () => {
    const sampleRate = 32000;
    const seconds = 1;
    const dataBytes = sampleRate * seconds * 2;
    const wav = Buffer.alloc(44 + dataBytes);
    wav.write('RIFF', 0, 'ascii');
    wav.writeUInt32LE(36 + dataBytes, 4);
    wav.write('WAVE', 8, 'ascii');
    wav.write('fmt ', 12, 'ascii');
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36, 'ascii');
    wav.writeUInt32LE(dataBytes, 40);

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'harmonia-job-test-')
    );
    const filePath = path.join(tempDir, 'valid.wav');
    await fs.writeFile(filePath, wav);

    await expect(
      (service as any).validateWav(filePath, 1)
    ).resolves.toMatchObject({
      channels: 1,
      sampleRate,
      bitsPerSample: 16,
      durationSeconds: 1,
      size: wav.length,
    });

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
