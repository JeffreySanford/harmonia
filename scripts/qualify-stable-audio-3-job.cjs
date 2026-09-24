#!/usr/bin/env node
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const backendBase = 'http://localhost:3000';
const frontendBase = 'http://localhost:4200';
const modelId = 'stable-audio-3-small-music';
const runtimeModelId = 'small-music';
const timeoutMs = 10 * 60 * 1000;
const pollMs = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}, timeout = 30000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout),
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

  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Stable Audio persistent job output is not RIFF/WAVE');
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
      throw new Error('Stable Audio persistent WAV contains a truncated chunk');
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
    throw new Error('Stable Audio persistent WAV is missing metadata');
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

async function main() {
  if (!existsSync(envPath)) {
    throw new Error('.env is missing');
  }

  const env = parseEnv(readFileSync(envPath, 'utf8'));
  const username = env.E2E_TEST_USER_USERNAME || 'test-user';
  const password = env.E2E_TEST_USER_PASSWORD || 'password';

  console.log('============================================================');
  console.log(' STABLE AUDIO 3 PERSISTENT JOB QUALIFICATION');
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
      `Stable Audio runtime did not reach ready: ${JSON.stringify(selected.body)}`
    );
  }

  console.log(
    `Runtime selected: ${selected.body.modelName || modelId} (ready)`
  );

  const requestedDuration = 8;
  const prompt =
    'energetic instrumental rock, 120 BPM, electric guitar, bass and drums, clean modern production';

  const created = await request(`${backendBase}/api/jobs`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jobType: 'generate',
      modelId,
      parameters: {
        title: 'Harmonia Stable Audio 3 Qualification',
        prompt,
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

  if (wav.channels !== 2) {
    throw new Error(`Expected stereo output, received ${wav.channels} channel(s)`);
  }
  if (wav.sampleRate !== 44100) {
    throw new Error(`Expected 44100 Hz output, received ${wav.sampleRate}`);
  }
  if (wav.bitsPerSample !== 32) {
    throw new Error(
      `Expected 32-bit float output, received ${wav.bitsPerSample}-bit`
    );
  }
  if (wav.audioFormat !== 3) {
    throw new Error(
      `Expected IEEE float WAV format 3, received ${wav.audioFormat}`
    );
  }
  if (wav.durationSeconds < requestedDuration * 0.9) {
    throw new Error(
      `WAV duration ${wav.durationSeconds.toFixed(2)}s is shorter than qualification threshold`
    );
  }

  const metadata = job.result?.metadata || {};
  if (metadata.providerId !== 'stable-audio-3') {
    throw new Error(`Unexpected provider metadata: ${metadata.providerId}`);
  }
  if (metadata.modelId !== modelId) {
    throw new Error(`Unexpected model metadata: ${metadata.modelId}`);
  }
  if (metadata.runtimeModelId !== runtimeModelId) {
    throw new Error(
      `Unexpected runtime model metadata: ${metadata.runtimeModelId}`
    );
  }

  const backendDownload = await fetch(`${backendBase}${outputPath}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!backendDownload.ok) {
    throw new Error(`Backend download failed: HTTP ${backendDownload.status}`);
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
  console.log(' STABLE AUDIO 3 PERSISTENT JOB QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`jobId              = ${jobId}`);
  console.log(`status             = ${job.status}`);
  console.log(`progress           = ${job.progress?.percentage}%`);
  console.log(`runtimeModelId     = ${metadata.runtimeModelId}`);
  console.log(`outputPath         = ${outputPath}`);
  console.log(`channels           = ${wav.channels}`);
  console.log(`sampleRate         = ${wav.sampleRate}`);
  console.log(`bitsPerSample      = ${wav.bitsPerSample}`);
  console.log(`audioFormat        = ${wav.audioFormat}`);
  console.log(`durationSeconds    = ${wav.durationSeconds.toFixed(2)}`);
  console.log(`artifactBytes      = ${wav.bytes}`);
  console.log(`generationElapsed  = ${elapsedSeconds.toFixed(2)}s`);
  console.log(`backend download   = HTTP ${backendDownload.status}`);
  console.log(`frontend download  = HTTP ${frontendDownload.status}`);
  console.log('STABLE_AUDIO_3_JOB_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('STABLE_AUDIO_3_JOB_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
