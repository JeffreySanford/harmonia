#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} = require('node:fs');
const path = require('node:path');

const backendBase = 'http://localhost:3000';
const modelId = 'diffsinger-acoustic-hifigan';
const containerName = 'harmonia-diffsinger';

async function request(url, options = {}, timeoutMs = 30000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} -> HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`
    );
  }

  return body;
}

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout || 10 * 60 * 1000,
  }).trim();
}

function findWavs(root) {
  const found = [];
  if (!existsSync(root)) return found;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...findWavs(target));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav')) {
      found.push(target);
    }
  }

  return found;
}

function inspectWav(filePath) {
  const file = readFileSync(filePath);

  if (
    file.length < 44 ||
    file.toString('ascii', 0, 4) !== 'RIFF' ||
    file.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error(`DiffSinger output is not a valid RIFF/WAVE file: ${filePath}`);
  }

  if (
    file
      .subarray(0, Math.min(file.length, 128))
      .includes(Buffer.from('HARMONIA_DIFFSINGER_PLACEHOLDER'))
  ) {
    throw new Error('DiffSinger output contains the legacy placeholder marker.');
  }

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let dataBytes = 0;

  while (offset + 8 <= file.length) {
    const chunkId = file.toString('ascii', offset, offset + 4);
    const chunkSize = file.readUInt32LE(offset + 4);
    const dataStart = offset + 8;

    if (dataStart + chunkSize > file.length) {
      throw new Error('DiffSinger WAV contains a truncated chunk.');
    }

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      channels = file.readUInt16LE(dataStart + 2);
      sampleRate = file.readUInt32LE(dataStart + 4);
      byteRate = file.readUInt32LE(dataStart + 8);
      bitsPerSample = file.readUInt16LE(dataStart + 14);
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
    }

    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  if (
    channels < 1 ||
    sampleRate < 8000 ||
    bitsPerSample < 8 ||
    byteRate < 1 ||
    dataBytes < 1
  ) {
    throw new Error('DiffSinger WAV is missing valid audio metadata.');
  }

  return {
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds: dataBytes / byteRate,
    bytes: file.length,
  };
}

function diagnostics() {
  console.error('');
  console.error('=== DIFFSINGER CONTAINER ===');
  try {
    console.error(
      docker([
        'inspect',
        '--format',
        'running={{.State.Running}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}',
        containerName,
      ])
    );
  } catch (error) {
    console.error(error.stderr?.toString?.() || error.message);
  }

  console.error('');
  console.error('=== DIFFSINGER CHECKPOINTS ===');
  try {
    console.error(
      docker([
        'exec',
        containerName,
        'bash',
        '-lc',
        "find /opt/DiffSinger/checkpoints /workspace/models/diffsinger -maxdepth 4 -type f \\( -name '*.ckpt' -o -name '*.yaml' -o -name '*.json' \\) 2>/dev/null | sort | sed -n '1,200p'",
      ])
    );
  } catch (error) {
    console.error(error.stderr?.toString?.() || error.message);
  }

  console.error('');
  console.error('=== DIFFSINGER LOG ===');
  try {
    console.error(docker(['logs', '--tail', '250', containerName]));
  } catch (error) {
    console.error(error.stderr?.toString?.() || error.message);
  }
}

async function main() {
  console.log('============================================================');
  console.log(' DIFFSINGER REAL INFERENCE QUALIFICATION');
  console.log('============================================================');

  await request(`${backendBase}/api/__health`);
  console.log('Backend is reachable.');

  const selected = await request(
    `${backendBase}/api/music/runtime/select`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId }),
    },
    5 * 60 * 1000
  );

  if (
    selected?.providerId !== 'diffsinger' ||
    selected?.modelId !== modelId ||
    selected?.state !== 'ready' ||
    selected?.healthy !== true
  ) {
    throw new Error(
      `DiffSinger runtime did not reach healthy/ready: ${JSON.stringify(selected)}`
    );
  }

  console.log(`Runtime selected: ${selected.modelName || modelId} (ready)`);

  docker([
    'exec',
    containerName,
    'bash',
    '-lc',
    [
      "test -f /tmp/harmonia-runtime-ready",
      "test -f /opt/DiffSinger/checkpoints/0102_xiaoma_pe/config.yaml",
      "find /opt/DiffSinger/checkpoints/0102_xiaoma_pe -maxdepth 1 -type f -name 'model_ckpt_steps_*.ckpt' -print -quit | grep -q .",
      "find /opt/DiffSinger/checkpoints/hifigan -type f -name '*.ckpt' -print -quit | grep -q .",
    ].join(' && '),
  ]);

  console.log('Acoustic and HiFi-GAN checkpoints are present.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const relativeDir = path.join('generated', 'diffsinger', 'inference', stamp);
  const hostDir = path.join(process.cwd(), relativeDir);
  const containerDir = `/workspace/${relativeDir.replace(/\\/g, '/')}`;
  const title = 'harmonia-diffsinger-qualification';

  mkdirSync(hostDir, { recursive: true });

  console.log('Running upstream DiffSinger acoustic + vocoder inference...');
  docker(
    [
      'exec',
      containerName,
      'python3',
      '/workspace/scripts/diffsinger_infer_helper.py',
      containerDir,
      title,
    ],
    { timeout: 15 * 60 * 1000 }
  );

  const wavs = findWavs(hostDir)
    .map((filePath) => ({
      filePath,
      mtime: statSync(filePath).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (wavs.length === 0) {
    throw new Error(
      `DiffSinger helper returned success but no WAV was written under ${relativeDir}`
    );
  }

  const outputPath = wavs[0].filePath;
  const wav = inspectWav(outputPath);

  if (wav.durationSeconds <= 0.1) {
    throw new Error(
      `DiffSinger generated implausibly short audio: ${wav.durationSeconds.toFixed(3)}s`
    );
  }

  console.log('');
  console.log('============================================================');
  console.log(' DIFFSINGER REAL INFERENCE QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`outputPath       = ${path.relative(process.cwd(), outputPath)}`);
  console.log(`channels         = ${wav.channels}`);
  console.log(`sampleRate       = ${wav.sampleRate}`);
  console.log(`bitsPerSample    = ${wav.bitsPerSample}`);
  console.log(`durationSeconds  = ${wav.durationSeconds.toFixed(2)}`);
  console.log(`artifactBytes    = ${wav.bytes}`);
  console.log('placeholder      = false');
  console.log('DIFFSINGER_INFERENCE_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('DIFFSINGER_INFERENCE_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  diagnostics();
  process.exitCode = 1;
});
