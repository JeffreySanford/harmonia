// Phase 2: Vocal Synthesis
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getFileSizeBytes(p) {
  try {
    return fs.statSync(p).size;
  } catch (e) {
    return 0;
  }
}

function isValidWav(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const header = Buffer.alloc(12);
    const bytes = fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);
    return (
      bytes === 12 &&
      header.toString('ascii', 0, 4) === 'RIFF' &&
      header.toString('ascii', 8, 12) === 'WAVE'
    );
  } catch {
    return false;
  }
}

function logDebug(phase, data) {
  const debugPath = path.join(__dirname, 'debug', `${phase}_input_output.json`);
  fs.writeFileSync(debugPath, JSON.stringify(data, null, 2));
}

async function synthesizeVocals(metadata) {
  // If metadata requests DiffSinger, call the Python wrapper
  const songsDir = path.join(__dirname, '..', 'generated', 'songs');
  if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const filename = `${metadata.title || 'Custom_Song'}_vocals-${ts}.wav`;
  const outPath = path.join(songsDir, filename);

  if (
    metadata.vocalSynthesisModel &&
    metadata.vocalSynthesisModel.toLowerCase() === 'diffsinger'
  ) {
    // Try running the DiffSinger wrapper inside the worker Docker image first
    try {
      const repoRoot = path.resolve(__dirname, '..');
      // Normalize paths for Docker (container expects POSIX paths under /workspace)
      const metaArg = process.argv[2] || '';
      const metaRel = path.relative(repoRoot, metaArg).replace(/\\/g, '/');
      const outRel = path.relative(repoRoot, outPath).replace(/\\/g, '/');
      // Ensure the repo root is mounted and also explicitly mount models/hifigan
      let modelsHifiganHost = path
        .join(repoRoot, 'models', 'hifigan')
        .replace(/\\/g, '/');
      // On Windows Docker, convert drive-letter absolute paths (C:/...) to /c/... form so Docker bind-mounts work reliably
      if (process.platform === 'win32') {
        const m = modelsHifiganHost.match(/^([A-Za-z]):\/(.*)/);
        if (m) {
          modelsHifiganHost = `/${m[1].toLowerCase()}/${m[2]}`;
        }
      }
      const dockerArgs = [
        'run',
        '--rm',
        '-v',
        `${repoRoot}:/workspace`,
        '-v',
        `${modelsHifiganHost}:/workspace/models/hifigan`,
        '-w',
        '/workspace',
        'harmonia/diffsinger:dev',
        'python3',
        'scripts/run_diffsinger.py',
        `/workspace/${metaRel}`,
        `/workspace/${outRel}`,
      ];
      const dock = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
      if (dock.status === 0 && isValidWav(outPath)) {
        const vocals = `DiffSinger output file: ${outPath}`;
        const result = { ...metadata, vocals };
        const size = getFileSizeBytes(outPath);
        logDebug('vocals', {
          input: metadata,
          output: result,
          artifact: { path: outPath, size },
        });
        return result;
      }
      // If docker failed, fall through to host python attempts
    } catch (err) {
      // continue to host fallback
    }

    // Host fallback: try python3 then python
    try {
      let py = spawnSync(
        'python3',
        [
          path.join(__dirname, '..', 'scripts', 'run_diffsinger.py'),
          process.argv[2] || '',
          outPath,
        ],
        { stdio: 'inherit' }
      );
      if (py.status !== 0) {
        py = spawnSync(
          'python',
          [
            path.join(__dirname, '..', 'scripts', 'run_diffsinger.py'),
            process.argv[2] || '',
            outPath,
          ],
          { stdio: 'inherit' }
        );
      }
      if (py.status !== 0 || !isValidWav(outPath)) {
        throw new Error(
          `DiffSinger failed to produce a valid WAV (exit=${py.status ?? 'unknown'})`
        );
      }
      const vocals = `DiffSinger output file: ${outPath}`;
      const result = { ...metadata, vocals };
      const size = getFileSizeBytes(outPath);
      logDebug('vocals', {
        input: metadata,
        output: result,
        artifact: { path: outPath, size },
      });
      return result;
    } catch (err) {
      logDebug('vocals', {
        input: metadata,
        error: String(err),
        artifact: { path: outPath, size: getFileSizeBytes(outPath) },
      });
      throw err;
    }
  } else {
    // Simulate vocal synthesis (replace with real logic or subprocess call)
    const vocals =
      metadata.vocals || `Synthesized vocals for: ${metadata.lyrics}`;
    const result = { ...metadata, vocals };
    // write artifact (wav simulation) to generated/songs
    fs.writeFileSync(outPath, result.vocals || '');
    const size = getFileSizeBytes(outPath);
    logDebug('vocals', {
      input: metadata,
      output: result,
      artifact: { path: outPath, size },
    });
    return result;
  }
}

if (require.main === module) {
  const metaFile = process.argv[2];
  if (!metaFile) throw new Error('No metadata file provided');
  const metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  synthesizeVocals(metadata).then((result) => {
    fs.writeFileSync(metaFile, JSON.stringify(result, null, 2));
    console.log('Vocals phase complete.');
  });
}
