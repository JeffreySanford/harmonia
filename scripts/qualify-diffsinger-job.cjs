#!/usr/bin/env node
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const backendBase = 'http://localhost:3000';
const frontendBase = 'http://localhost:4200';
const timeoutMs = 10 * 60 * 1000;
const pollMs = 2000;

const score = {
  text: 'SP一闪一闪亮晶晶SP满天都是小星星',
  notes:
    'rest|C4|C4|G4|G4|A4|A4|G4|rest|F4|F4|E4|E4|D4|D4|C4',
  notesDuration:
    '1|0.5|0.5|0.5|0.5|0.5|0.5|0.75|0.25|0.5|0.5|0.5|0.5|0.5|0.5|0.75',
  inputType: 'word',
};

const requestedDuration = score.notesDuration
  .split(/[|\s]+/)
  .filter(Boolean)
  .map(Number)
  .reduce((sum, value) => sum + value, 0);

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

  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Generated artifact is not RIFF/WAVE audio');
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

    if (start + size > buffer.length) {
      throw new Error('WAV contains a truncated chunk');
    }

    if (id === 'fmt ' && size >= 16) {
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      byteRate = buffer.readUInt32LE(start + 8);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      dataBytes = size;
    }

    offset = start + size + (size % 2);
  }

  if (!channels || !sampleRate || !bitsPerSample || !byteRate || dataBytes == null) {
    throw new Error('WAV is missing required fmt/data metadata');
  }

  return {
    bytes: buffer.length,
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
  console.log(' DIFFSINGER PERSISTENT JOB QUALIFICATION');
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
    body: JSON.stringify({ modelId: 'diffsinger-acoustic-hifigan' }),
  });

  console.log(
    `Runtime selected: ${select.body?.modelName || select.body?.modelId || 'diffsinger-acoustic-hifigan'} (${select.body?.state || 'unknown'})`
  );

  const status = await request(`${backendBase}/api/music/runtime/status`);
  if (
    status.body?.modelId !== 'diffsinger-acoustic-hifigan' ||
    status.body?.state !== 'ready' ||
    status.body?.healthy !== true
  ) {
    throw new Error(
      `DiffSinger is not ready after selection: ${JSON.stringify(status.body)}`
    );
  }

  const created = await request(`${backendBase}/api/jobs`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jobType: 'generate',
      modelId: 'diffsinger-acoustic-hifigan',
      parameters: {
        title: 'Harmonia DiffSinger Persistent Job Qualification',
        ...score,
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
  const requestPath = path.join(root, 'exports', 'jobs', jobId, 'request.json');

  if (!existsSync(filePath)) {
    throw new Error(`Generated artifact does not exist: ${filePath}`);
  }

  if (!existsSync(requestPath)) {
    throw new Error(`Durable DiffSinger request does not exist: ${requestPath}`);
  }

  const requestPayload = JSON.parse(readFileSync(requestPath, 'utf8'));
  if (
    requestPayload.text !== score.text ||
    requestPayload.notes !== score.notes ||
    requestPayload.notes_duration !== score.notesDuration
  ) {
    throw new Error(
      `Persisted DiffSinger score does not match request: ${JSON.stringify(requestPayload)}`
    );
  }

  const wav = readWav(filePath);

  if (wav.durationSeconds < requestedDuration * 0.9) {
    throw new Error(
      `WAV duration ${wav.durationSeconds.toFixed(2)}s is shorter than score threshold ${requestedDuration.toFixed(2)}s`
    );
  }

  if (job.result?.metadata?.providerId !== 'diffsinger') {
    throw new Error(
      `Unexpected provider metadata: ${JSON.stringify(job.result?.metadata)}`
    );
  }

  if (
    job.result?.metadata?.runtimeModelId !== '0228_opencpop_ds100_rel'
  ) {
    throw new Error(
      `Unexpected runtimeModelId: ${job.result?.metadata?.runtimeModelId}`
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
  console.log(' DIFFSINGER PERSISTENT JOB QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`jobId              = ${jobId}`);
  console.log(`status             = ${job.status}`);
  console.log(`progress           = ${job.progress?.percentage}%`);
  console.log(`runtimeModelId     = ${job.result?.metadata?.runtimeModelId}`);
  console.log(`outputPath         = ${outputPath}`);
  console.log(`scoreDuration      = ${requestedDuration.toFixed(2)}s`);
  console.log(`channels           = ${wav.channels}`);
  console.log(`sampleRate         = ${wav.sampleRate}`);
  console.log(`bitsPerSample      = ${wav.bitsPerSample}`);
  console.log(`durationSeconds    = ${wav.durationSeconds.toFixed(2)}`);
  console.log(`artifactBytes      = ${wav.bytes}`);
  console.log(`generationElapsed  = ${elapsedSeconds.toFixed(2)}s`);
  console.log(`backend download   = HTTP ${backendDownload.status}`);
  console.log(`frontend download  = HTTP ${frontendDownload.status}`);
  console.log('placeholder        = false');
  console.log('DIFFSINGER_JOB_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('DIFFSINGER_JOB_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
