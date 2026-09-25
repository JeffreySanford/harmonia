#!/usr/bin/env node
const {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const presetRoot = path.join(root, 'showcase', 'qualified-generators');
const exportRoot = path.join(root, 'exports', 'showcase');

const modelIds = [
  'musicgen-small',
  'musicgen-stereo-small',
  'diffsinger-acoustic-hifigan',
  'stable-audio-3-small-music',
  'acestep-v15-turbo-06b',
];

const pollMs = 2000;
const jobTimeoutMs = 20 * 60 * 1000;
const selectTimeoutMs = 20 * 60 * 1000;

function localDateStamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}, timeout = 30000) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const cause =
      error && typeof error === 'object' && error.cause
        ? ` cause=${JSON.stringify({
            name: error.cause.name,
            code: error.cause.code,
            errno: error.cause.errno,
            syscall: error.cause.syscall,
            address: error.cause.address,
            port: error.cause.port,
            message: error.cause.message,
          })}`
        : '';

    throw new Error(
      `${options.method || 'GET'} ${url} fetch failed: ${
        error instanceof Error ? error.message : String(error)
      }${cause}`
    );
  }

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

async function requestLong(url, options = {}, timeout = selectTimeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body =
      options.body == null
        ? null
        : Buffer.isBuffer(options.body)
          ? options.body
          : Buffer.from(String(options.body));

    const headers = {
      ...(options.headers || {}),
    };

    if (body && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')) {
      headers['content-length'] = String(body.length);
    }

    const req = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: options.method || 'GET',
        headers,
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;

          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
          }

          if ((response.statusCode || 500) >= 400) {
            reject(
              new Error(
                `${options.method || 'GET'} ${url} -> HTTP ${response.statusCode}: ${
                  typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
                }`
              )
            );
            return;
          }

          resolve({
            response: {
              ok: true,
              status: response.statusCode || 200,
            },
            body: parsed,
          });
        });
      }
    );

    req.setTimeout(timeout, () => {
      req.destroy(
        new Error(
          `${options.method || 'GET'} ${url} timed out after ${Math.round(
            timeout / 1000
          )} seconds`
        )
      );
    });

    req.once('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function firstHealthyBackend() {
  const explicit = process.env.HARMONIA_SHOWCASE_BACKEND_BASE;
  const candidates = explicit
    ? [explicit]
    : ['http://localhost:3112', 'http://localhost:3000'];

  for (const candidate of candidates) {
    try {
      await request(`${candidate}/api/__health`, {}, 5000);
      return candidate.replace(/\/$/, '');
    } catch {
      // Try the next supported local backend.
    }
  }

  throw new Error(
    `No Harmonia backend is reachable. Tried: ${candidates.join(', ')}`
  );
}

function readPreset(modelId) {
  const presetPath = path.join(presetRoot, modelId, 'preset.json');
  if (!existsSync(presetPath)) {
    throw new Error(`Missing showcase preset: ${presetPath}`);
  }

  const preset = JSON.parse(readFileSync(presetPath, 'utf8'));

  if (
    preset.modelId !== modelId ||
    !preset.slug ||
    !preset.title ||
    !preset.parameters
  ) {
    throw new Error(`Invalid showcase preset: ${presetPath}`);
  }

  return preset;
}

function readWav(filePath) {
  const buffer = readFileSync(filePath);

  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error(`Showcase artifact is not RIFF/WAVE: ${filePath}`);
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
      throw new Error(`Truncated WAV chunk in ${filePath}`);
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
    !audioFormat ||
    !channels ||
    !sampleRate ||
    !bitsPerSample ||
    !byteRate ||
    !dataBytes
  ) {
    throw new Error(`WAV metadata is incomplete: ${filePath}`);
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

function expectedDuration(preset) {
  if (preset.modelId === 'diffsinger-acoustic-hifigan') {
    return String(preset.parameters.notesDuration)
      .split(/[|\s]+/)
      .filter(Boolean)
      .map(Number)
      .reduce((sum, value) => sum + value, 0);
  }

  return Number(preset.parameters.duration);
}

async function waitForJob(backendBase, token, job) {
  const started = Date.now();
  let current = job;

  while (!['completed', 'failed', 'cancelled'].includes(current.status)) {
    if (Date.now() - started > jobTimeoutMs) {
      throw new Error(
        `Job ${current.id} timed out after ${Math.round(
          jobTimeoutMs / 1000
        )} seconds`
      );
    }

    await sleep(pollMs);

    current = (
      await request(`${backendBase}/api/jobs/${current.id}`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).body;

    console.log(
      `  status=${current.status} progress=${
        current.progress?.percentage ?? '?'
      }% ${current.progress?.message || ''}`
    );
  }

  if (current.status !== 'completed') {
    throw new Error(
      `Job ${current.id} ended as ${current.status}: ${
        current.result?.error || JSON.stringify(current.result)
      }`
    );
  }

  return current;
}

async function generateOne({
  backendBase,
  frontendBase,
  token,
  dateStamp,
  preset,
}) {
  console.log('');
  console.log('============================================================');
  console.log(` ${preset.modelId}`);
  console.log(` ${preset.title}`);
  console.log('============================================================');

  const modelDir = path.join(exportRoot, preset.modelId);
  mkdirSync(modelDir, { recursive: true });

  const basename = `${dateStamp}--${preset.slug}`;
  const showcaseWav = path.join(modelDir, `${basename}.wav`);
  const requestFile = path.join(modelDir, `${basename}.request.json`);
  const jobFile = path.join(modelDir, `${basename}.job.json`);
  const requestedDuration = expectedDuration(preset);

  if (
    existsSync(showcaseWav) &&
    existsSync(requestFile) &&
    existsSync(jobFile)
  ) {
    const job = JSON.parse(readFileSync(jobFile, 'utf8'));
    const wav = readWav(showcaseWav);
    const outputPath = job.result?.outputPath;

    if (
      job.status !== 'completed' ||
      !outputPath ||
      !outputPath.startsWith('/downloads/jobs/') ||
      wav.durationSeconds < requestedDuration * 0.9
    ) {
      throw new Error(
        `Existing showcase artifact is incomplete for ${preset.modelId}`
      );
    }

    const backendDownload = await fetch(`${backendBase}${outputPath}`, {
      signal: AbortSignal.timeout(30000),
    });
    const frontendDownload = await fetch(`${frontendBase}${outputPath}`, {
      signal: AbortSignal.timeout(30000),
    });

    if (!backendDownload.ok || !frontendDownload.ok) {
      throw new Error(
        `Existing showcase download validation failed for ${preset.modelId}: backend=${backendDownload.status}, frontend=${frontendDownload.status}`
      );
    }

    const startedAt = Date.parse(job.startedAt || '');
    const completedAt = Date.parse(job.completedAt || '');
    const generationElapsedSeconds =
      Number.isFinite(startedAt) && Number.isFinite(completedAt)
        ? Math.max(0, (completedAt - startedAt) / 1000)
        : 0;

    const result = {
      date: dateStamp,
      modelId: preset.modelId,
      title: preset.title,
      slug: preset.slug,
      jobId: job.id,
      runtimeModelId: job.result?.metadata?.runtimeModelId || null,
      sourceDownloadPath: outputPath,
      showcasePath: path.relative(root, showcaseWav).replace(/\\/g, '/'),
      requestedDurationSeconds: requestedDuration,
      generationElapsedSeconds,
      wav,
      backendDownloadStatus: backendDownload.status,
      frontendDownloadStatus: frontendDownload.status,
      reusedExisting: true,
    };

    console.log(
      `SHOWCASE_REUSE ${preset.modelId}: ${result.showcasePath} (${wav.durationSeconds.toFixed(
        2
      )}s)`
    );

    return result;
  }

  const selected = await requestLong(
    `${backendBase}/api/music/runtime/select`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId: preset.modelId }),
    },
    selectTimeoutMs
  );

  if (
    selected.body?.modelId !== preset.modelId ||
    selected.body?.state !== 'ready' ||
    selected.body?.healthy !== true
  ) {
    throw new Error(
      `Runtime selection failed for ${preset.modelId}: ${JSON.stringify(
        selected.body
      )}`
    );
  }

  console.log(
    `Runtime ready: ${selected.body.modelName || preset.modelId}`
  );

  const createPayload = {
    jobType: 'generate',
    modelId: preset.modelId,
    parameters: preset.parameters,
  };

  const created = await request(`${backendBase}/api/jobs`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  const jobId = created.body?.id;
  if (!jobId) {
    throw new Error(
      `Job creation returned no id for ${preset.modelId}: ${JSON.stringify(
        created.body
      )}`
    );
  }

  console.log(`Job created: ${jobId}`);

  const started = Date.now();
  const job = await waitForJob(backendBase, token, created.body);
  const generationElapsedSeconds = (Date.now() - started) / 1000;

  const outputPath = job.result?.outputPath;
  if (!outputPath || !outputPath.startsWith('/downloads/jobs/')) {
    throw new Error(
      `Unexpected outputPath for ${preset.modelId}: ${outputPath}`
    );
  }

  const jobArtifactPath = path.join(
    root,
    'exports',
    'jobs',
    jobId,
    path.basename(outputPath)
  );

  if (!existsSync(jobArtifactPath)) {
    throw new Error(`Missing generated artifact: ${jobArtifactPath}`);
  }

  const wav = readWav(jobArtifactPath);

  if (
    !Number.isFinite(requestedDuration) ||
    requestedDuration <= 0 ||
    wav.durationSeconds < requestedDuration * 0.9
  ) {
    throw new Error(
      `Unexpected duration for ${preset.modelId}: requested=${requestedDuration}, actual=${wav.durationSeconds.toFixed(
        2
      )}`
    );
  }

  if (
    preset.modelId === 'musicgen-stereo-small' &&
    wav.channels !== 2
  ) {
    throw new Error(
      `MusicGen Stereo Small returned ${wav.channels} channel(s)`
    );
  }

  if (
    preset.modelId === 'stable-audio-3-small-music' &&
    (
      wav.channels !== 2 ||
      wav.sampleRate !== 44100 ||
      wav.audioFormat !== 3
    )
  ) {
    throw new Error(
      `Stable Audio showcase output contract changed: ${JSON.stringify(wav)}`
    );
  }

  if (
    preset.modelId === 'acestep-v15-turbo-06b' &&
    job.result?.metadata?.aceStep?.lyrics !== preset.parameters.lyrics
  ) {
    throw new Error('ACE-Step showcase did not preserve supplied lyrics');
  }

  const backendDownload = await fetch(`${backendBase}${outputPath}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!backendDownload.ok) {
    throw new Error(
      `Backend download failed for ${preset.modelId}: HTTP ${backendDownload.status}`
    );
  }

  const frontendDownload = await fetch(`${frontendBase}${outputPath}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!frontendDownload.ok) {
    throw new Error(
      `Frontend download failed for ${preset.modelId}: HTTP ${frontendDownload.status}`
    );
  }

  copyFileSync(jobArtifactPath, showcaseWav);
  writeFileSync(
    requestFile,
    JSON.stringify(
      {
        date: dateStamp,
        preset,
        createPayload,
        sourceJobId: jobId,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  writeFileSync(
    jobFile,
    JSON.stringify(job, null, 2) + '\n',
    'utf8'
  );

  if (preset.parameters.prompt) {
    writeFileSync(
      path.join(modelDir, `${basename}.prompt.txt`),
      String(preset.parameters.prompt).trim() + '\n',
      'utf8'
    );
  }

  if (preset.parameters.lyrics) {
    writeFileSync(
      path.join(modelDir, `${basename}.lyrics.txt`),
      String(preset.parameters.lyrics).trim() + '\n',
      'utf8'
    );
  }

  if (preset.modelId === 'diffsinger-acoustic-hifigan') {
    writeFileSync(
      path.join(modelDir, `${basename}.score.json`),
      JSON.stringify(
        {
          text: preset.parameters.text,
          notes: preset.parameters.notes,
          notesDuration: preset.parameters.notesDuration,
          inputType: preset.parameters.inputType,
          lyricTranslation: preset.lyricTranslation,
          styleNote: preset.styleNote,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  }

  const result = {
    date: dateStamp,
    modelId: preset.modelId,
    title: preset.title,
    slug: preset.slug,
    jobId,
    runtimeModelId: job.result?.metadata?.runtimeModelId || null,
    sourceDownloadPath: outputPath,
    showcasePath: path.relative(root, showcaseWav).replace(/\\/g, '/'),
    requestedDurationSeconds: requestedDuration,
    generationElapsedSeconds,
    wav,
    backendDownloadStatus: backendDownload.status,
    frontendDownloadStatus: frontendDownload.status,
  };

  console.log(
    `SHOWCASE_OK ${preset.modelId}: ${result.showcasePath} (${wav.durationSeconds.toFixed(
      2
    )}s)`
  );

  return result;
}

async function main() {
  if (!existsSync(envPath)) {
    throw new Error('.env is missing');
  }

  const env = parseEnv(readFileSync(envPath, 'utf8'));
  const username = env.E2E_TEST_USER_USERNAME || 'test-user';
  const password = env.E2E_TEST_USER_PASSWORD || 'password';
  const backendBase = await firstHealthyBackend();
  const frontendBase = (
    process.env.HARMONIA_SHOWCASE_FRONTEND_BASE ||
    'http://localhost:4200'
  ).replace(/\/$/, '');

  await request(frontendBase, {}, 10000);

  const dateStamp = process.env.SHOWCASE_DATE || localDateStamp();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStamp)) {
    throw new Error(
      `SHOWCASE_DATE must use YYYY-MM-DD; received ${dateStamp}`
    );
  }

  const only = new Set(
    String(process.env.SHOWCASE_ONLY || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const selectedIds =
    only.size === 0
      ? modelIds
      : modelIds.filter((modelId) => only.has(modelId));

  if (selectedIds.length === 0) {
    throw new Error(
      `SHOWCASE_ONLY selected no qualified models: ${[
        ...only,
      ].join(', ')}`
    );
  }

  console.log('============================================================');
  console.log(' HARMONIA QUALIFIED GENERATOR SHOWCASE');
  console.log('============================================================');
  console.log(`date     = ${dateStamp}`);
  console.log(`backend  = ${backendBase}`);
  console.log(`frontend = ${frontendBase}`);
  console.log(`models   = ${selectedIds.join(', ')}`);

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
    throw new Error('Showcase login succeeded without an access token');
  }

  console.log(
    `Authenticated as ${login.body.user?.username || username}.`
  );

  const results = [];

  for (const modelId of selectedIds) {
    results.push(
      await generateOne({
        backendBase,
        frontendBase,
        token,
        dateStamp,
        preset: readPreset(modelId),
      })
    );
  }

  mkdirSync(exportRoot, { recursive: true });
  const manifestPath = path.join(
    exportRoot,
    `${dateStamp}--qualified-generators.manifest.json`
  );
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 'harmonia-qualified-generator-showcase-v1',
        date: dateStamp,
        backendBase,
        frontendBase,
        results,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log('');
  console.log('============================================================');
  console.log(' QUALIFIED GENERATOR SHOWCASE COMPLETE');
  console.log('============================================================');
  for (const result of results) {
    console.log(
      `${result.modelId.padEnd(32)} ${result.wav.durationSeconds
        .toFixed(2)
        .padStart(7)}s  ${result.showcasePath}`
    );
  }
  console.log(
    `manifest = ${path.relative(root, manifestPath).replace(/\\/g, '/')}`
  );
  console.log('QUALIFIED_GENERATOR_SHOWCASE_OK');
}

main().catch((error) => {
  console.error('');
  console.error('QUALIFIED_GENERATOR_SHOWCASE_FAILED');
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : String(error)
  );
  process.exitCode = 1;
});
