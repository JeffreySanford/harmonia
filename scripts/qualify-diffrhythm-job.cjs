#!/usr/bin/env node
'use strict';

const crypto =
  require('node:crypto');

const {
  existsSync,
  readFileSync,
} =
  require('node:fs');

const path =
  require('node:path');

const {
  authenticateQualificationUser,
  selectRuntimeModel,
} =
  require('./runtime-selection-client.cjs');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const backendBase =
  String(
    process.env.HARMONIA_QUALIFY_BACKEND_BASE ||
    'http://127.0.0.1:3116'
  ).replace(
    /\/$/,
    ''
  );

const frontendBase =
  String(
    process.env.HARMONIA_QUALIFY_FRONTEND_BASE ||
    'http://127.0.0.1:4216'
  ).replace(
    /\/$/,
    ''
  );

const modelId =
  'diffrhythm-v12-base';

const runtimeModelId =
  'diffrhythm-v12-base';

const requestedDuration =
  95;

const seed =
  1607;

const prompt =
  'cinematic electronic rock, driving live drums, warm bass, bright synthesizers, spacious electric guitar, expressive clean vocal, expansive modern stereo production';

const lyrics =
  [
    '[00:00.00] Northern signal crossing the open sky',
    '[00:48.00] Prairie lights carry the rhythm home',
  ].join(
    '\n'
  );

const timeoutMs =
  20 * 60 * 1000;

const pollMs =
  2000;

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function sha256(buffer) {
  return crypto
    .createHash(
      'sha256'
    )
    .update(buffer)
    .digest(
      'hex'
    );
}

async function request(
  url,
  options = {},
  timeout = 30000
) {
  const response =
    await fetch(
      url,
      {
        ...options,
        signal:
          AbortSignal.timeout(
            timeout
          ),
      }
    );

  const text =
    await response.text();

  let body = null;

  if (text) {
    try {
      body =
        JSON.parse(
          text
        );
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} -> HTTP ${response.status}: ${
        typeof body === 'string'
          ? body
          : JSON.stringify(body)
      }`
    );
  }

  return {
    response,
    body,
  };
}

function readWav(buffer) {
  if (
    buffer.length < 44 ||
    buffer.toString(
      'ascii',
      0,
      4
    ) !== 'RIFF' ||
    buffer.toString(
      'ascii',
      8,
      12
    ) !== 'WAVE'
  ) {
    throw new Error(
      'DiffRhythm backend artifact is not RIFF/WAVE'
    );
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;

  while (
    offset + 8 <=
    buffer.length
  ) {
    const id =
      buffer.toString(
        'ascii',
        offset,
        offset + 4
      );

    const size =
      buffer.readUInt32LE(
        offset + 4
      );

    const start =
      offset + 8;

    if (
      start + size >
      buffer.length
    ) {
      throw new Error(
        `DiffRhythm WAV chunk ${id} is truncated`
      );
    }

    if (
      id === 'fmt ' &&
      size >= 16
    ) {
      audioFormat =
        buffer.readUInt16LE(
          start
        );

      channels =
        buffer.readUInt16LE(
          start + 2
        );

      sampleRate =
        buffer.readUInt32LE(
          start + 4
        );

      byteRate =
        buffer.readUInt32LE(
          start + 8
        );

      bitsPerSample =
        buffer.readUInt16LE(
          start + 14
        );
    }

    if (id === 'data') {
      dataBytes = size;
    }

    offset =
      start +
      size +
      (
        size % 2
      );
  }

  if (
    !audioFormat ||
    !channels ||
    !sampleRate ||
    !byteRate ||
    !bitsPerSample ||
    !dataBytes
  ) {
    throw new Error(
      'DiffRhythm WAV metadata is incomplete'
    );
  }

  return {
    bytes:
      buffer.length,
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds:
      dataBytes /
      byteRate,
  };
}

async function downloadProtected(
  base,
  artifactPath,
  token
) {
  const response =
    await fetch(
      `${base}${artifactPath}`,
      {
        headers: {
          authorization:
            `Bearer ${token}`,
        },
        signal:
          AbortSignal.timeout(
            30000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Protected artifact download from ${base} failed: HTTP ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

async function main() {
  console.log(
    '============================================================'
  );

  console.log(
    ' DIFFRHYTHM AUTHENTICATED BACKEND JOB QUALIFICATION'
  );

  console.log(
    '============================================================'
  );

  await request(
    `${backendBase}/api/__health`
  );

  await request(
    frontendBase
  );

  console.log(
    `backend  = ${backendBase}`
  );

  console.log(
    `frontend = ${frontendBase}`
  );

  const auth =
    await authenticateQualificationUser({
      backendBase,
    });

  console.log(
    `Authenticated as ${auth.username}.`
  );

  const {
    acceptance,
    status,
  } =
    await selectRuntimeModel({
      backendBase,
      token:
        auth.token,
      modelId,
      expectedProviderId:
        'diffrhythm',
      timeoutMs,
      pollMs,
    });

  console.log(
    `Runtime ready: model=${status.modelId} provider=${status.providerId} operation=${acceptance.operationId}`
  );

  const created =
    await request(
      `${backendBase}/api/jobs`,
      {
        method:
          'POST',
        headers: {
          authorization:
            `Bearer ${auth.token}`,
          'content-type':
            'application/json',
        },
        body:
          JSON.stringify({
            jobType:
              'generate',
            modelId,
            parameters: {
              title:
                'Harmonia DiffRhythm M16 E3C Qualification',
              prompt,
              lyrics,
              duration:
                requestedDuration,
              seed,
              genre:
                'Cinematic Electronic Rock',
              mood:
                'Expansive',
              bpm:
                112,
              instruments: [
                'electric guitar',
                'bass',
                'drums',
                'synthesizer',
              ],
              vocalsStyle:
                'clean',
            },
          }),
      }
    );

  const jobId =
    created.body?.id;

  if (!jobId) {
    throw new Error(
      'Job creation returned no id: ' +
      JSON.stringify(
        created.body
      )
    );
  }

  console.log(
    `Generation job created: ${jobId}`
  );

  const started =
    Date.now();

  let job =
    created.body;

  while (
    ![
      'completed',
      'failed',
      'cancelled',
    ].includes(
      job.status
    )
  ) {
    if (
      Date.now() -
      started >
      timeoutMs
    ) {
      throw new Error(
        'DiffRhythm backend generation timed out'
      );
    }

    await sleep(
      pollMs
    );

    job =
      (
        await request(
          `${backendBase}/api/jobs/${jobId}`,
          {
            headers: {
              authorization:
                `Bearer ${auth.token}`,
            },
          }
        )
      ).body;

    console.log(
      `status=${job.status} progress=${job.progress?.percentage ?? '?'}% message=${job.progress?.message || ''}`
    );
  }

  if (
    job.status !==
    'completed'
  ) {
    throw new Error(
      `DiffRhythm job ended as ${job.status}: ${
        job.result?.error ||
        JSON.stringify(
          job.result
        )
      }`
    );
  }

  const artifactPath =
    `/api/jobs/${jobId}/artifact`;

  if (
    job.result?.outputPath !==
    artifactPath
  ) {
    throw new Error(
      `Unexpected durable output path: ${job.result?.outputPath}`
    );
  }

  const localPath =
    path.join(
      root,
      'exports',
      'jobs',
      jobId,
      'music.wav'
    );

  if (
    !existsSync(
      localPath
    )
  ) {
    throw new Error(
      `Durable WAV missing: ${localPath}`
    );
  }

  const localBuffer =
    readFileSync(
      localPath
    );

  const wav =
    readWav(
      localBuffer
    );

  if (
    wav.audioFormat !== 1
  ) {
    throw new Error(
      `Expected PCM WAV format 1; received ${wav.audioFormat}`
    );
  }

  if (
    wav.channels !== 2
  ) {
    throw new Error(
      `Expected stereo; received ${wav.channels} channels`
    );
  }

  if (
    wav.sampleRate !==
    44100
  ) {
    throw new Error(
      `Expected 44100 Hz; received ${wav.sampleRate}`
    );
  }

  if (
    wav.bitsPerSample !==
    16
  ) {
    throw new Error(
      `Expected PCM16; received ${wav.bitsPerSample} bits`
    );
  }

  if (
    wav.durationSeconds <
      94.5 ||
    wav.durationSeconds >
      95.5
  ) {
    throw new Error(
      `Unexpected duration: ${wav.durationSeconds}`
    );
  }

  if (
    wav.bytes <
    16_000_000
  ) {
    throw new Error(
      `DiffRhythm WAV is unexpectedly small: ${wav.bytes}`
    );
  }

  const metadata =
    job.result?.metadata ||
    {};

  const upstream =
    metadata.diffRhythm ||
    {};

  if (
    metadata.providerId !==
    'diffrhythm'
  ) {
    throw new Error(
      `Unexpected provider metadata: ${metadata.providerId}`
    );
  }

  if (
    metadata.modelId !==
    modelId
  ) {
    throw new Error(
      `Unexpected model metadata: ${metadata.modelId}`
    );
  }

  if (
    metadata.runtimeModelId !==
    runtimeModelId
  ) {
    throw new Error(
      `Unexpected runtime model id: ${metadata.runtimeModelId}`
    );
  }

  if (
    metadata.prompt !==
    prompt
  ) {
    throw new Error(
      'Durable metadata did not preserve prompt'
    );
  }

  if (
    metadata.lyrics !==
    lyrics
  ) {
    throw new Error(
      'Durable metadata did not preserve lyrics'
    );
  }

  if (
    metadata.seed !==
    seed
  ) {
    throw new Error(
      `Durable metadata seed=${metadata.seed}`
    );
  }

  if (
    metadata.requestedDurationSeconds !==
    requestedDuration
  ) {
    throw new Error(
      `Durable requested duration=${metadata.requestedDurationSeconds}`
    );
  }

  if (
    upstream.ok !== true ||
    upstream.provider !==
      'diffrhythm' ||
    upstream.model !==
      runtimeModelId ||
    upstream.prompt !==
      prompt ||
    upstream.lyrics !==
      lyrics ||
    upstream.seed !==
      seed ||
    upstream.duration !==
      requestedDuration ||
    upstream.channels !==
      2 ||
    upstream.sampleRate !==
      44100
  ) {
    throw new Error(
      'Provider result metadata changed: ' +
      JSON.stringify(
        upstream
      )
    );
  }

  const expectedContainerPath =
    `/workspace/exports/jobs/${jobId}/music.wav`;

  if (
    upstream.output !==
    expectedContainerPath
  ) {
    throw new Error(
      `Provider output=${upstream.output}`
    );
  }

  const backendBuffer =
    await downloadProtected(
      backendBase,
      artifactPath,
      auth.token
    );

  const frontendBuffer =
    await downloadProtected(
      frontendBase,
      artifactPath,
      auth.token
    );

  const localHash =
    sha256(
      localBuffer
    );

  const backendHash =
    sha256(
      backendBuffer
    );

  const frontendHash =
    sha256(
      frontendBuffer
    );

  if (
    localHash !==
      backendHash ||
    localHash !==
      frontendHash
  ) {
    throw new Error(
      [
        'Artifact hashes differ:',
        `local=${localHash}`,
        `backend=${backendHash}`,
        `frontend=${frontendHash}`,
      ].join(
        ' '
      )
    );
  }

  const elapsedSeconds =
    (
      Date.now() -
      started
    ) /
    1000;

  console.log('');
  console.log(
    '============================================================'
  );
  console.log(
    ' DIFFRHYTHM AUTHENTICATED BACKEND JOB: GREEN'
  );
  console.log(
    '============================================================'
  );
  console.log(
    `jobId=${jobId}`
  );
  console.log(
    `status=${job.status}`
  );
  console.log(
    `runtimeModelId=${metadata.runtimeModelId}`
  );
  console.log(
    `channels=${wav.channels}`
  );
  console.log(
    `sampleRate=${wav.sampleRate}`
  );
  console.log(
    `bitsPerSample=${wav.bitsPerSample}`
  );
  console.log(
    `audioFormat=${wav.audioFormat}`
  );
  console.log(
    `durationSeconds=${wav.durationSeconds.toFixed(6)}`
  );
  console.log(
    `artifactBytes=${wav.bytes}`
  );
  console.log(
    `sha256=${localHash}`
  );
  console.log(
    `generationElapsed=${elapsedSeconds.toFixed(2)}s`
  );
  console.log(
    `diffusionSeconds=${Number(upstream.timing?.diffusionSeconds || 0).toFixed(2)}`
  );
  console.log(
    `decodeSeconds=${Number(upstream.timing?.decodeSeconds || 0).toFixed(2)}`
  );
  console.log(
    `providerTotalSeconds=${Number(upstream.timing?.totalSeconds || 0).toFixed(2)}`
  );
  console.log(
    'backendDownload=BYTE_IDENTICAL'
  );
  console.log(
    'frontendDownload=BYTE_IDENTICAL'
  );
  console.log(
    'DIFFRHYTHM_BACKEND_JOB_QUALIFICATION_OK'
  );
}

main().catch(
  (error) => {
    console.error('');
    console.error(
      'DIFFRHYTHM_BACKEND_JOB_QUALIFICATION_FAILED'
    );
    console.error(
      error instanceof Error
        ? error.stack ||
          error.message
        : String(error)
    );
    process.exitCode = 1;
  }
);
