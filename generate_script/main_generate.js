// Main Orchestrator Script
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const phases = [
  'phase_lyrics.js',
  'phase_vocals.js',
  'phase_instrumental.js',
  'phase_mixing.js',
];

function logPhase(phase, status) {
  console.log(`[${new Date().toISOString()}] ${phase}: ${status}`);
}

function runPhase(phaseScript, metaFile) {
  logPhase(phaseScript, 'START');
  const result = spawnSync(
    'node',
    [path.join(__dirname, phaseScript), metaFile],
    {
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    logPhase(phaseScript, 'FAILED');
    process.exit(result.status);
  }
  logPhase(phaseScript, 'COMPLETE');
}

if (require.main === module) {
  const metaFile = process.argv[2];
  if (!metaFile) throw new Error('No metadata file provided');
  if (!fs.existsSync(metaFile)) throw new Error('Metadata file does not exist');
  phases.forEach((phase) => runPhase(phase, metaFile));
  console.log('All phases complete. See debug/ for details.');
}
