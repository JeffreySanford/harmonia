#!/usr/bin/env node
/**
 * Bulk Instrument Generation Script for Harmonia
 *
 * Generates audio for multiple instruments using MusicGen
 * Saves all generated instruments to generated/instruments/
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const INSTRUMENTS = [
  'piano',
  'guitar_acoustic',
  'guitar_electric',
  'bass',
  'drums',
  'violin',
  'cello',
  'flute',
  'trumpet',
  'saxophone',
  'organ',
  'choir',
  'synth_lead',
  'synth_pad',
  'bass_synth',
];

const DURATION = 5; // seconds
const OUTPUT_DIR = path.join(__dirname, '..', 'generated', 'instruments');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

async function generateInstrument(instrument) {
  return new Promise((resolve, reject) => {
    log(`🎵 Generating ${instrument}...`, colors.blue);

    const dockerCmd = `docker exec harmonia-worker bash -c "cd /workspace && python3 scripts/generate_musicgen_audio.py --instrument ${instrument} --duration ${DURATION}"`;

    exec(dockerCmd, (error, stdout, stderr) => {
      if (error) {
        log(
          `❌ Failed to generate ${instrument}: ${error.message}`,
          colors.red
        );
        reject(error);
        return;
      }

      if (stderr) {
        log(`⚠️  ${instrument} stderr: ${stderr}`, colors.yellow);
      }

      log(`✅ Generated ${instrument} successfully`, colors.green);

      // Extract the full container path from output
      const pathMatch = stdout.match(/Audio generation completed: (.+)/);
      const containerPath = pathMatch
        ? pathMatch[1]
        : `/workspace/generated/instruments/${instrument}.wav`;

      resolve({ instrument, containerPath });
    });
  });
}

async function generateAllInstruments() {
  log(`🎼 Starting bulk instrument generation...`, colors.blue);
  log(`📁 Output directory: ${OUTPUT_DIR}`, colors.blue);
  log(`⏱️  Duration per instrument: ${DURATION} seconds`, colors.blue);
  log(`🎵 Instruments to generate: ${INSTRUMENTS.length}`, colors.blue);
  log('');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log(`📁 Created output directory: ${OUTPUT_DIR}`, colors.green);
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const instrument of INSTRUMENTS) {
    try {
      const result = await generateInstrument(instrument);
      results.push(result);
      successCount++;

      // Copy file from container to host
      const hostFilename = path.basename(result.containerPath);
      const hostPath = path.join(OUTPUT_DIR, hostFilename);
      const dockerPath = `harmonia-worker:${result.containerPath}`;

      exec(`docker cp "${dockerPath}" "${hostPath}"`, (copyError) => {
        if (copyError) {
          log(
            `⚠️  Failed to copy ${instrument} to host: ${copyError.message}`,
            colors.yellow
          );
        } else {
          log(`📋 Copied ${instrument} to host: ${hostFilename}`, colors.green);
        }
      });
    } catch (error) {
      failCount++;
      log(`❌ Failed ${instrument}: ${error.message}`, colors.red);
    }

    // Small delay between generations to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  log('');
  log(`🎼 Bulk generation completed!`, colors.green);
  log(`✅ Successful: ${successCount}`, colors.green);
  log(`❌ Failed: ${failCount}`, failCount > 0 ? colors.red : colors.green);
  log(`📁 Check generated/instruments/ for audio files`, colors.blue);
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.yellow}Bulk Instrument Generation Script${colors.reset}

${colors.blue}Usage:${colors.reset}
  node scripts/generate-instruments.js

${colors.blue}Description:${colors.reset}
  Generates audio samples for all supported instruments using MusicGen.
  Saves files to generated/instruments/ with timestamped filenames.

${colors.blue}Instruments Generated:${colors.reset}
  ${INSTRUMENTS.join(', ')}

${colors.blue}Requirements:${colors.reset}
  - Docker container 'harmonia-worker' must be running
  - MusicGen model must be available in container

${colors.blue}Output:${colors.reset}
  - Files saved as: YYYY-MM-DDTHH-MM-SS_instrument.wav
  - Location: generated/instruments/
`);
  process.exit(0);
}

// Run the generation
generateAllInstruments().catch((error) => {
  log(`💥 Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});
