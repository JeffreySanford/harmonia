#!/usr/bin/env node
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const backendBase = 'http://localhost:3000';
const frontendBase = 'http://localhost:4200';
const timeoutMs = 5 * 60 * 1000;
const pollMs = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30000),
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

function readWav(filePath) {
  const buffer = readFileSync(filePath);

  if (buffer.length < 44) {
    throw new Error(`WAV is too small: ${buffer.length} bytes`);
  }

  if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('WAV is missing RIFF header');
  }

  if (buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('WAV is missing WAVE signature');
  }

  let offset = 12;
  let channels = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let byteRate = null;
  let dataBytes = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (id === 'fmt ' && size >= 16 && start + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      byteRate = buffer.readUInt32LE(start + 8);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    }

    if (id === 'data') {
      dataBytes = size;
    }

    offset = start + size + (size % 2);
  }

  if (!channels || !sampleRate || !bitsPerSample || !byteRate || dataBytes == null) {
    throw new Error('WAV is missing required fmt/data metadata');
  }

  const durationSeconds = dataBytes / byteRate;

  return {
    bytes: buffer.length,
    channels,
    sampleRate,
    bitsPerSample,
    dataBytes,
    durationSeconds,
  };
}

async function main() {
  if (!existsSync(envPath)) {
    throw new Error('.env is missing');
  }

  const env = parseEnv(readFileSync(envPath, 'utf8'));
  const username = env.E2E_TEST_USER_USERNAME || 'test-user';
  const password = env.E2E_TEST_USER_PASSWORD || 'password';

  console.log('============================================================');
  console.log(' MUSICGEN SMALL PRODUCT QUALIFICATION');
  console.log('============================================================');

  await request(`${backendBase}/api/__health`);
  await request(frontendBase);
  console.log('Backend and frontend are reachable.');

  const login = await request(`${backendBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrUsername: username,
      password,
    }),
  });

  const token = login.body?.accessToken;
  if (!token) {
    throw new Error('Login succeeded without an access token');
  }

  console.log(`Authenticated as ${login.body.user?.username || username}.`);

  const select = await request(`${backendBase}/api/music/runtime/select`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modelId: 'musicgen-small' }),
  });

  console.log(
    `Runtime selected: ${select.body?.modelName || select.body?.modelId || 'musicgen-small'} (${select.body?.state || 'unknown'})`
  );

  const status = await request(`${backendBase}/api/music/runtime/status`);
  if (status.body?.modelId !== 'musicgen-small' || status.body?.state !== 'ready') {
    throw new Error(
      `MusicGen Small is not ready after selection: ${JSON.stringify(status.body)}`
    );
  }

  const requestedDuration = 8;
  const created = await request(`${backendBase}/api/jobs`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jobType: 'generate',
      modelId: 'musicgen-small',
      parameters: {
        title: 'Harmonia MusicGen Small Qualification',
        prompt:
          'energetic instrumental rock, 120 BPM, electric guitar, bass and drums, clean production',
        duration: requestedDuration,
        genre: 'Rock',
        mood: 'Energetic',
        bpm: 120,
        instruments: ['electric guitar', 'bass', 'drums'],
        vocalsStyle: 'instrumental',
      },
    }),
  });

  const jobId = created.body?.id;
  if (!jobId) {
    throw new Error(`Job creation returned no id: ${JSON.stringify(created.body)}`);
  }

  console.log(`Generation job created: ${jobId}`);

  const started = Date.now();
  let job = created.body;

  while (!['completed', 'failed', 'cancelled'].includes(job.status)) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        `Generation timed out after ${Math.round(timeoutMs / 1000)} seconds`
      );
    }

    await sleep(pollMs);

    const current = await request(`${backendBase}/api/jobs/${jobId}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    job = current.body;

    console.log(
      `status=${job.status} progress=${job.progress?.percentage ?? '?'}% message=${job.progress?.message || ''}`
    );
  }

  if (job.status !== 'completed') {
    throw new Error(
      `Generation ended as ${job.status}: ${job.result?.error || JSON.stringify(job.result)}`
    );
  }

  const outputPath = job.result?.outputPath;
  if (!outputPath || !outputPath.startsWith('/downloads/jobs/')) {
    throw new Error(`Unexpected outputPath: ${outputPath}`);
  }

  const filePath = path.join(
    root,
    'exports',
    'jobs',
    jobId,
    path.basename(outputPath)
  );

  if (!existsSync(filePath)) {
    throw new Error(`Generated artifact does not exist: ${filePath}`);
  }

  const wav = readWav(filePath);

  if (wav.durationSeconds < requestedDuration * 0.9) {
    throw new Error(
      `WAV duration ${wav.durationSeconds.toFixed(2)}s is shorter than qualification threshold`
    );
  }

  const backendDownload = await fetch(`${backendBase}${outputPath}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (!backendDownload.ok) {
    throw new Error(
      `Backend download failed: HTTP ${backendDownload.status}`
    );
  }

  const frontendDownload = await fetch(`${frontendBase}${outputPath}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (!frontendDownload.ok) {
    throw new Error(
      `Frontend proxied download failed: HTTP ${frontendDownload.status}`
    );
  }

  const elapsedSeconds = (Date.now() - started) / 1000;

  console.log('');
  console.log('============================================================');
  console.log(' MUSICGEN SMALL QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`jobId              = ${jobId}`);
  console.log(`status             = ${job.status}`);
  console.log(`progress           = ${job.progress?.percentage}%`);
  console.log(`outputPath         = ${outputPath}`);
  console.log(`channels           = ${wav.channels}`);
  console.log(`sampleRate         = ${wav.sampleRate}`);
  console.log(`bitsPerSample      = ${wav.bitsPerSample}`);
  console.log(`durationSeconds    = ${wav.durationSeconds.toFixed(2)}`);
  console.log(`artifactBytes      = ${wav.bytes}`);
  console.log(`generationElapsed  = ${elapsedSeconds.toFixed(2)}s`);
  console.log(`backend download   = HTTP ${backendDownload.status}`);
  console.log(`frontend download  = HTTP ${frontendDownload.status}`);
  console.log('MUSICGEN_SMALL_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('MUSICGEN_SMALL_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
