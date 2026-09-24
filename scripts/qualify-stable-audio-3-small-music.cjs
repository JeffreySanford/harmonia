#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const {
  existsSync,
  mkdirSync,
  readFileSync,
} = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const backendBase = 'http://localhost:3000';
const frontendBase = 'http://localhost:4200';
const modelId = 'stable-audio-3-small-music';
const runtimeModelId = 'small-music';
const containerName = 'harmonia-stable-audio-3';
const requestedDuration = 8;

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

  return { response, body };
}

function docker(args, timeout = 20 * 60 * 1000) {
  return execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
  }).trim();
}

function readWav(filePath) {
  const buffer = readFileSync(filePath);

  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Stable Audio 3 output is not RIFF/WAVE audio');
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let dataBytes = 0;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (start + size > buffer.length) {
      throw new Error('Stable Audio 3 WAV contains a truncated chunk');
    }

    if (id === 'fmt ' && size >= 16) {
      audioFormat = buffer.readUInt16LE(start);
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      byteRate = buffer.readUInt32LE(start + 8);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      dataBytes = size;
    }

    offset = start + size + (size % 2);
  }

  if (![1, 3].includes(audioFormat)) {
    throw new Error(`Unsupported WAV audio format: ${audioFormat}`);
  }

  if (!channels || !sampleRate || !bitsPerSample || !byteRate || !dataBytes) {
    throw new Error('Stable Audio 3 WAV is missing required metadata');
  }

  return {
    bytes: buffer.length,
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds: dataBytes / byteRate,
  };
}

function diagnostics() {
  console.error('');
  console.error('=== STABLE AUDIO 3 CONTAINER ===');
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
  console.error('=== STABLE AUDIO 3 LOG ===');
  try {
    console.error(docker(['logs', '--tail', '300', containerName]));
  } catch (error) {
    console.error(error.stderr?.toString?.() || error.message);
  }
}

async function main() {
  if (!existsSync(envPath)) {
    throw new Error('.env is missing');
  }

  const env = parseEnv(readFileSync(envPath, 'utf8'));
  console.log('============================================================');
  console.log(' STABLE AUDIO 3 SMALL-MUSIC QUALIFICATION');
  console.log('============================================================');
  const tokenConfigured = Boolean(
    process.env.HF_TOKEN ||
      env.HF_TOKEN ||
      process.env.HUGGINGFACE_API_KEY ||
      env.HUGGINGFACE_API_KEY ||
      process.env.HUGGING_FACE_HUB_TOKEN ||
      env.HUGGING_FACE_HUB_TOKEN ||
      process.env.HUGGINGFACE_HUB_TOKEN ||
      env.HUGGINGFACE_HUB_TOKEN
  );
  console.log(`Hugging Face token configured = ${tokenConfigured}`);

  await request(`${backendBase}/api/__health`);
  await request(frontendBase);
  console.log('Backend and frontend are reachable.');

  const selected = await request(
    `${backendBase}/api/music/runtime/select`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId }),
    },
    10 * 60 * 1000
  );

  if (
    selected.body?.providerId !== 'stable-audio-3' ||
    selected.body?.modelId !== modelId ||
    selected.body?.state !== 'ready' ||
    selected.body?.healthy !== true
  ) {
    throw new Error(
      `Stable Audio 3 selection did not reach healthy/ready: ${JSON.stringify(selected.body)}`
    );
  }

  console.log(
    `Runtime selected: ${selected.body.modelName || modelId} (ready)`
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const relativeDir = path.join(
    'generated',
    'stable-audio-3',
    'small-music',
    stamp
  );
  const hostDir = path.join(root, relativeDir);
  const outputPath = path.join(hostDir, 'small-music.wav');
  const containerOutput =
    `/workspace/${relativeDir.replace(/\\/g, '/')}/small-music.wav`;

  mkdirSync(hostDir, { recursive: true });

  const prompt =
    'energetic instrumental rock, 120 BPM, electric guitar, bass and drums, clean modern production';

  console.log('Running real Stable Audio 3 Small-Music inference...');
  const started = Date.now();

  const clientOutput = docker([
    'exec',
    containerName,
    'python',
    '/workspace/scripts/stable_audio_3_provider_client.py',
    '--output',
    containerOutput,
    '--duration',
    String(requestedDuration),
    '--model',
    runtimeModelId,
    '--prompt',
    prompt,
  ]);

  if (clientOutput) {
    console.log(clientOutput);
  }

  if (!existsSync(outputPath)) {
    throw new Error(`Stable Audio 3 generated no artifact: ${outputPath}`);
  }

  const wav = readWav(outputPath);

  if (wav.channels !== 2) {
    throw new Error(
      `Expected Stable Audio 3 stereo output, received ${wav.channels} channel(s)`
    );
  }

  if (wav.sampleRate !== 44100) {
    throw new Error(
      `Expected Stable Audio 3 sample rate 44100 Hz, received ${wav.sampleRate}`
    );
  }

  if (wav.bitsPerSample !== 32) {
    throw new Error(
      `Expected Stable Audio 3 32-bit float WAV, received ${wav.bitsPerSample}-bit`
    );
  }

  if (wav.durationSeconds < requestedDuration * 0.9) {
    throw new Error(
      `Stable Audio 3 WAV duration ${wav.durationSeconds.toFixed(2)}s is shorter than requested ${requestedDuration}s`
    );
  }

  const healthText = docker([
    'exec',
    containerName,
    'python',
    '-c',
    [
      'import json, urllib.request',
      "print(urllib.request.urlopen('http://127.0.0.1:8766/health', timeout=3).read().decode())",
    ].join('; '),
  ]);
  const health = JSON.parse(healthText);

  if (
    health.ready !== true ||
    health.model !== runtimeModelId ||
    health.busy !== false
  ) {
    throw new Error(
      `Stable Audio 3 provider did not remain resident/ready: ${healthText}`
    );
  }

  const elapsedSeconds = (Date.now() - started) / 1000;

  console.log('');
  console.log('============================================================');
  console.log(' STABLE AUDIO 3 SMALL-MUSIC QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`runtimeModelId    = ${runtimeModelId}`);
  console.log(`device            = ${health.device}`);
  console.log(`cuda              = ${health.cuda}`);
  console.log(`outputPath         = ${path.relative(root, outputPath)}`);
  console.log(`channels           = ${wav.channels}`);
  console.log(`sampleRate         = ${wav.sampleRate}`);
  console.log(`bitsPerSample      = ${wav.bitsPerSample}`);
  console.log(`audioFormat        = ${wav.audioFormat}`);
  console.log(`durationSeconds    = ${wav.durationSeconds.toFixed(2)}`);
  console.log(`artifactBytes      = ${wav.bytes}`);
  console.log(`generationElapsed  = ${elapsedSeconds.toFixed(2)}s`);
  console.log('STABLE_AUDIO_3_SMALL_MUSIC_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('STABLE_AUDIO_3_SMALL_MUSIC_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  diagnostics();
  process.exitCode = 1;
});
