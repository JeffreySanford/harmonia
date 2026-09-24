#!/usr/bin/env node
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const backendBase =
  process.env.HARMONIA_QUALIFY_BACKEND_BASE ||
  'http://localhost:3000';
const frontendBase =
  process.env.HARMONIA_QUALIFY_FRONTEND_BASE ||
  'http://localhost:4200';
const modelId = 'acestep-v15-turbo-06b';
const runtimeModelId = 'acestep-v15-turbo';
const lmModelId = 'acestep-5Hz-lm-0.6B';
const requestedDuration = 30;
const timeoutMs = 30 * 60 * 1000;
const pollMs = 3000;

const prompt =
  'uplifting alternative rock, 118 BPM, electric guitar, bass, steady drums, warm clean vocal, wide modern production';

const lyrics = `[Verse]
Under northern skies we find our way
One more mile into the open day

[Chorus]
True north keeps us moving
When the road is hard to see
True north keeps us moving
Toward the place we want to be`;

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
      `${options.method || 'GET'} ${url} -> HTTP ${response.status}: ${
        typeof body === 'string' ? body : JSON.stringify(body)
      }`
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
    throw new Error('ACE-Step persistent job output is not RIFF/WAVE');
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
      throw new Error('ACE-Step WAV contains a truncated chunk');
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

  if (
    ![1, 3].includes(audioFormat) ||
    !channels ||
    !sampleRate ||
    !bitsPerSample ||
    !byteRate ||
    !dataBytes
  ) {
    throw new Error('ACE-Step WAV is missing valid fmt/data metadata');
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
  console.log(' ACE-STEP 1.5 PERSISTENT JOB QUALIFICATION');
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
    20 * 60 * 1000
  );

  if (
    selected.body?.providerId !== 'ace-step-1.5' ||
    selected.body?.modelId !== modelId ||
    selected.body?.state !== 'ready' ||
    selected.body?.healthy !== true
  ) {
    throw new Error(
      `ACE-Step runtime did not reach ready: ${JSON.stringify(selected.body)}`
    );
  }

  console.log(
    `Runtime selected: ${selected.body.modelName || modelId} (ready)`
  );

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
        title: 'Harmonia ACE-Step Phase 12D Qualification',
        prompt,
        lyrics,
        duration: requestedDuration,
        genre: 'alternative',
        mood: 'uplifting',
        bpm: 118,
        instruments: ['electric guitar', 'bass', 'drums'],
        vocalsStyle: 'clean',
        vocalLanguage: 'en',
        seed: 12012026,
      },
    }),
  });

  const jobId = created.body?.id;
  if (!jobId) {
    throw new Error(
      `Job creation returned no id: ${JSON.stringify(created.body)}`
    );
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
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    job = current.body;

    console.log(
      `status=${job.status} progress=${job.progress?.percentage ?? '?'}% message=${
        job.progress?.message || ''
      }`
    );
  }

  if (job.status !== 'completed') {
    throw new Error(
      `Generation ended as ${job.status}: ${
        job.result?.error || JSON.stringify(job.result)
      }`
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
      `WAV duration ${wav.durationSeconds.toFixed(
        2
      )}s is shorter than qualification threshold`
    );
  }

  const metadata = job.result?.metadata || {};
  const ace = metadata.aceStep || {};

  if (metadata.providerId !== 'ace-step-1.5') {
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

  if (metadata.lyrics !== lyrics) {
    throw new Error('Harmonia durable metadata did not preserve supplied lyrics');
  }

  if (ace.lyrics !== lyrics) {
    throw new Error(
      `ACE-Step result did not preserve supplied lyrics: ${JSON.stringify(ace.lyrics)}`
    );
  }

  if (ace.ditModel !== runtimeModelId) {
    throw new Error(`Unexpected ACE DiT model: ${ace.ditModel}`);
  }

  if (ace.lmModel !== lmModelId) {
    throw new Error(`Unexpected ACE LM model: ${ace.lmModel}`);
  }

  if (!ace.taskId) {
    throw new Error('ACE-Step result did not preserve upstream task id');
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
  console.log(' ACE-STEP 1.5 PERSISTENT JOB QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`jobId              = ${jobId}`);
  console.log(`aceTaskId           = ${ace.taskId}`);
  console.log(`status              = ${job.status}`);
  console.log(`progress            = ${job.progress?.percentage}%`);
  console.log(`runtimeModelId      = ${metadata.runtimeModelId}`);
  console.log(`aceDiTModel         = ${ace.ditModel}`);
  console.log(`aceLMModel          = ${ace.lmModel}`);
  console.log(`lyricsPreserved     = ${ace.lyrics === lyrics}`);
  console.log(`outputPath          = ${outputPath}`);
  console.log(`channels            = ${wav.channels}`);
  console.log(`sampleRate          = ${wav.sampleRate}`);
  console.log(`bitsPerSample       = ${wav.bitsPerSample}`);
  console.log(`audioFormat         = ${wav.audioFormat}`);
  console.log(`durationSeconds     = ${wav.durationSeconds.toFixed(2)}`);
  console.log(`artifactBytes       = ${wav.bytes}`);
  console.log(`generationElapsed   = ${elapsedSeconds.toFixed(2)}s`);
  console.log(`backend download    = HTTP ${backendDownload.status}`);
  console.log(`frontend download   = HTTP ${frontendDownload.status}`);
  console.log('ACE_STEP_JOB_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('ACE_STEP_JOB_QUALIFICATION_FAILED');
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : String(error)
  );
  process.exitCode = 1;
});
