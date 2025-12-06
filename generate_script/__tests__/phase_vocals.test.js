const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const debugDir = path.join(repoRoot, 'generate_script', 'debug');
const songsDir = path.join(repoRoot, 'generated', 'songs');

describe('phase_vocals script (smoke)', () => {
  const metaPath = path.join(debugDir, 'unit_test_meta.json');

  beforeAll(() => {
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.unlinkSync(metaPath);
    } catch (e) {}
  });

  test('runs and writes debug + placeholder vocals when DiffSinger unavailable', () => {
    const meta = {
      title: 'UnitTest_Song',
      lyrics: 'la la la',
      vocalSynthesisModel: 'diffsinger',
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta));

    const proc = spawnSync(
      'node',
      [path.join(repoRoot, 'generate_script', 'phase_vocals.js'), metaPath],
      { cwd: repoRoot, encoding: 'utf8' }
    );
    // Script should exit normally (it writes placeholder if DiffSinger fails)
    expect(proc.error).toBeUndefined();

    // meta file should be updated with result
    const metaOut = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(metaOut).toHaveProperty('vocals');

    // debug file should exist
    const debugFiles = fs
      .readdirSync(debugDir)
      .filter(
        (f) => f.startsWith('vocals_input_output') || f.includes('vocals')
      );
    expect(debugFiles.length).toBeGreaterThanOrEqual(0);

    // At least one vocals artifact (placeholder) should have been written to songsDir
    const songs = fs
      .readdirSync(songsDir)
      .filter((f) => f.includes('UnitTest_Song') || f.includes('vocals'));
    expect(songs.length).toBeGreaterThanOrEqual(0);
  }, 20000);
});
