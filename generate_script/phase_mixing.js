// Phase 4: Mixing
const fs = require('fs');
const path = require('path');

function getFileSizeBytes(p) {
  try {
    return fs.statSync(p).size;
  } catch (e) {
    return 0;
  }
}

function logDebug(phase, data) {
  const debugPath = path.join(__dirname, 'debug', `${phase}_input_output.json`);
  fs.writeFileSync(debugPath, JSON.stringify(data, null, 2));
}

async function mixTracks(metadata) {
  // Simulate mixing (replace with real logic or subprocess call)
  const mix =
    metadata.mix || `Mixed: ${metadata.vocals} + ${metadata.instrumental}`;
  const result = { ...metadata, mix };
  // write final mix artifact to generated/songs
  const songsDir = path.join(__dirname, '..', 'generated', 'songs');
  if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const filename = `${result.title || 'Custom_Song'}_mixed-${ts}.wav`;
  const outPath = path.join(songsDir, filename);
  fs.writeFileSync(outPath, result.mix || '');
  const size = getFileSizeBytes(outPath);
  logDebug('mixing', {
    input: metadata,
    output: result,
    artifact: { path: outPath, size },
  });
  return result;
}

if (require.main === module) {
  const metaFile = process.argv[2];
  if (!metaFile) throw new Error('No metadata file provided');
  const metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  mixTracks(metadata).then((result) => {
    fs.writeFileSync(metaFile, JSON.stringify(result, null, 2));
    console.log('Mixing phase complete.');
  });
}
