#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseEnv,
} = require('node:util');

const {
  selectRuntimeModel,
} = require('./runtime-selection-client.cjs');

const {
  cases,
} = require(
  '../tests/model-qualification/model-generation-cases.cjs'
);

const root =
  path.resolve(__dirname, '..');

const envPath =
  path.join(root, '.env');

const rawArgs =
  process.argv.slice(2);

function argumentValue(flag) {
  const index =
    rawArgs.indexOf(flag);

  if (index < 0) {
    return null;
  }

  const value =
    rawArgs[index + 1];

  if (
    !value ||
    value.startsWith('--')
  ) {
    throw new Error(
      flag + ' requires a value'
    );
  }

  return value;
}

const planOnly =
  rawArgs.includes('--plan');

const listOnly =
  rawArgs.includes('--list');

const requestedCaseId =
  argumentValue('--case');

const requestedModelId =
  argumentValue('--model');

const requestedProfile =
  String(
    argumentValue('--profile') ||
    process.env.HARMONIA_MODEL_MATRIX_PROFILE ||
    'smoke'
  ).trim();

if (
  !['smoke', 'deep'].includes(
    requestedProfile
  )
) {
  throw new Error(
    'Unsupported qualification profile: ' +
      requestedProfile
  );
}
const backendBase =
  String(
    process.env.HARMONIA_QUAL_BACKEND_BASE ||
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '');

const frontendBase =
  String(
    process.env.HARMONIA_QUAL_FRONTEND_BASE ||
    'http://127.0.0.1:4200'
  ).replace(/\/$/, '');

const outputRoot =
  path.join(
    root,
    'generated',
    'evidence',
    'model-matrix'
  );

const pollMs = 2000;

const jobTimeoutMs =
  30 * 60 * 1000;

const selectTimeoutMs =
  30 * 60 * 1000;

function sha256(buffer) {
  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex');
}

function sleep(ms) {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

async function request(
  url,
  options = {},
  timeout = 30000
) {
  const response =
    await fetch(url, {
      ...options,
      signal:
        AbortSignal.timeout(timeout),
    });

  const text =
    await response.text();

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
  assert.ok(
    buffer.length >= 44,
    'WAV is too small'
  );

  assert.equal(
    buffer.toString('ascii', 0, 4),
    'RIFF'
  );

  assert.equal(
    buffer.toString('ascii', 8, 12),
    'WAVE'
  );

  let offset = 12;

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;

  while (
    offset + 8 <= buffer.length
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

    assert.ok(
      start + size <= buffer.length,
      `Truncated WAV chunk ${id}`
    );

    if (
      id === 'fmt ' &&
      size >= 16
    ) {
      audioFormat =
        buffer.readUInt16LE(start);

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
      (size % 2);
  }

  assert.ok(audioFormat);
  assert.ok(channels);
  assert.ok(sampleRate);
  assert.ok(byteRate);
  assert.ok(bitsPerSample);
  assert.ok(dataBytes);

  return {
    bytes: buffer.length,
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds:
      dataBytes / byteRate,
  };
}

function expectedDuration(entry) {
  if (
    entry.modelId ===
    'diffsinger-acoustic-hifigan'
  ) {
    return String(
      entry.parameters.notesDuration
    )
      .split(/[|\s]+/)
      .filter(Boolean)
      .map(Number)
      .reduce(
        (sum, value) =>
          sum + value,
        0
      );
  }

  return Number(
    entry.parameters.duration
  );
}

function fitIsRunnable(model) {
  return (
    model.availability ===
      'installed' &&
    model.selectable === true &&
    (
      model.hardwareFit ===
        'recommended' ||
      model.hardwareFit ===
        'supported'
    )
  );
}

function profileCasesFor(modelId) {
  return cases.filter(
    (entry) => {
      if (
        entry.modelId !==
        modelId
      ) {
        return false;
      }

      if (requestedCaseId) {
        return (
          entry.id ===
          requestedCaseId
        );
      }

      return (
        entry.profile === 'smoke' ||
        (
          requestedProfile === 'deep' &&
          entry.profile === 'deep'
        )
      );
    }
  );
}

async function createAuthSession() {
  if (!fs.existsSync(envPath)) {
    throw new Error('.env is missing');
  }

  const env =
    parseEnv(
      fs.readFileSync(
        envPath,
        'utf8'
      )
    );

  const username =
    env.E2E_TEST_USER_USERNAME ||
    'test-user';

  const password =
    env.E2E_TEST_USER_PASSWORD ||
    'password';

  let token = null;
  let expiresAt = 0;

  async function renew(reason) {
    const loginResponse =
      await request(
        backendBase +
          '/api/auth/login',
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            emailOrUsername:
              username,
            password,
          }),
        }
      );

    assert.ok(
      loginResponse.body?.accessToken,
      'Login must return accessToken'
    );

    token =
      loginResponse.body.accessToken;

    const expiresIn =
      Number(
        loginResponse.body.expiresIn ||
        900
      );

    expiresAt =
      Date.now() +
      expiresIn * 1000;

    console.log(
      'AUTH_SESSION_RENEWED reason=' +
      reason +
      ' expiresIn=' +
      expiresIn +
      's'
    );

    return token;
  }

  return {
    async getToken() {
      if (
        !token ||
        Date.now() >=
          expiresAt - 60_000
      ) {
        return renew(
          token
            ? 'expiring'
            : 'initial'
        );
      }

      return token;
    },

    async forceRenew(
      reason = '401'
    ) {
      return renew(reason);
    },
  };
}

async function authorizedRequest(
  auth,
  url,
  options = {},
  timeout = 30000
) {
  const execute =
    async () => {
      const token =
        await auth.getToken();

      return request(
        url,
        {
          ...options,
          headers: {
            ...(options.headers || {}),
            authorization:
              'Bearer ' + token,
          },
        },
        timeout
      );
    };

  try {
    return await execute();
  } catch (error) {
    if (
      error instanceof Error &&
      /HTTP 401/.test(error.message)
    ) {
      await auth.forceRenew(
        'protected-request-401'
      );

      return execute();
    }

    throw error;
  }
}
async function waitForJob(
  jobId,
  auth
) {
  const started =
    Date.now();

  while (
    Date.now() - started <
    jobTimeoutMs
  ) {
    const current =
      (
        await authorizedRequest(
          auth,
          backendBase +
            '/api/jobs/' +
            jobId
        )
      ).body;

    console.log(
      '  job=' + jobId +
      ' status=' + current.status +
      ' progress=' +
      (
        current.progress?.percentage ??
        '?'
      ) +
      '% ' +
      (
        current.progress?.message ||
        ''
      )
    );

    if (
      [
        'completed',
        'failed',
        'cancelled',
      ].includes(current.status)
    ) {
      return current;
    }

    await sleep(pollMs);
  }

  throw new Error(
    'Job ' +
    jobId +
    ' timed out'
  );
}

async function getArtifact(
  base,
  pathName,
  auth
) {
  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const token =
      await auth.getToken();

    const response =
      await fetch(
        base + pathName,
        {
          headers: {
            authorization:
              'Bearer ' + token,
          },
          signal:
            AbortSignal.timeout(
              120000
            ),
        }
      );

    if (
      response.status === 401 &&
      attempt === 0
    ) {
      await auth.forceRenew(
        'artifact-401'
      );
      continue;
    }

    if (!response.ok) {
      throw new Error(
        'Artifact ' +
        base +
        pathName +
        ' -> HTTP ' +
        response.status
      );
    }

    const bytes =
      Buffer.from(
        await response.arrayBuffer()
      );

    return {
      status: response.status,
      contentType:
        response.headers.get(
          'content-type'
        ),
      bytes,
    };
  }

  throw new Error(
    'Artifact authentication retry exhausted'
  );
}
function assertProviderSpecific(
  entry,
  job,
  wav
) {
  const expect =
    entry.expect || {};

  if (
    expect.channels !==
    undefined
  ) {
    assert.equal(
      wav.channels,
      expect.channels,
      `${entry.id} channel count`
    );
  }

  if (
    expect.sampleRate !==
    undefined
  ) {
    assert.equal(
      wav.sampleRate,
      expect.sampleRate,
      `${entry.id} sample rate`
    );
  }

  if (
    expect.audioFormat !==
    undefined
  ) {
    assert.equal(
      wav.audioFormat,
      expect.audioFormat,
      `${entry.id} WAV format`
    );
  }

  if (
    entry.modelId ===
    'diffsinger-acoustic-hifigan'
  ) {
    assert.equal(
      job.result?.metadata?.text,
      entry.parameters.text
    );

    assert.equal(
      job.result?.metadata?.notes,
      entry.parameters.notes
    );

    assert.equal(
      job.result?.metadata
        ?.notesDuration,
      entry.parameters
        .notesDuration
    );
  }

  if (
    entry.modelId ===
    'acestep-v15-turbo-06b'
  ) {
    assert.equal(
      job.result?.metadata
        ?.aceStep?.lyrics,
      entry.parameters.lyrics,
      `${entry.id} supplied lyrics must survive provider generation`
    );
  }
}

async function runCase(
  entry,
  model,
  auth
) {
  console.log('');
  console.log(
    '============================================================'
  );
  console.log(
    ` CASE ${entry.id}`
  );
  console.log(
    ` ${model.name}`
  );
  console.log(
    '============================================================'
  );

  const selection =
    await selectRuntimeModel({
      backendBase,
      tokenProvider:
        () =>
          auth.getToken(),
      modelId:
        entry.modelId,
      timeoutMs:
        selectTimeoutMs,
      pollMs,
    });

  assert.equal(
    selection.status.state,
    'ready'
  );

  assert.equal(
    selection.status.healthy,
    true
  );

  assert.equal(
    selection.status.modelId,
    entry.modelId
  );

  const created =
    await authorizedRequest(
      auth,
      `${backendBase}/api/jobs`,
      {
        method: 'POST',
        headers: {
          'content-type':
            'application/json',
        },
        body: JSON.stringify({
          jobType:
            'generate',
          modelId:
            entry.modelId,
          parameters:
            entry.parameters,
        }),
      }
    );

  const jobId =
    created.body?.id;

  assert.ok(
    jobId,
    `${entry.id} must create a job`
  );

  console.log(
    `created job=${jobId}`
  );

  const job =
    await waitForJob(
      jobId,
      auth
    );

  assert.equal(
    job.status,
    'completed',
    `${entry.id}: ${
      job.result?.error ||
      'generation did not complete'
    }`
  );

  assert.equal(
    job.modelId,
    entry.modelId
  );

  assert.equal(
    job.result?.metadata?.modelId,
    entry.modelId
  );

  assert.ok(
    job.result?.metadata
      ?.runtimeModelId
  );

  assert.ok(
    model.runtimeModelId,
    `${entry.id}: catalog must define runtimeModelId`
  );

  assert.equal(
    job.result?.metadata?.runtimeModelId,
    model.runtimeModelId,
    `${entry.id}: runtime model id must match catalog runtimeModelId`
  );

  const artifactPath =
    `/api/jobs/${jobId}/artifact`;

  assert.equal(
    job.result?.outputPath,
    artifactPath
  );

  const direct =
    await getArtifact(
      backendBase,
      artifactPath,
      auth
    );

  const throughFrontend =
    await getArtifact(
      frontendBase,
      artifactPath,
      auth
    );

  assert.match(
    direct.contentType || '',
    /audio\/wav/i
  );

  assert.match(
    throughFrontend
      .contentType || '',
    /audio\/wav/i
  );

  const directHash =
    sha256(direct.bytes);

  const frontendHash =
    sha256(
      throughFrontend.bytes
    );

  assert.equal(
    frontendHash,
    directHash,
    'frontend artifact must be byte-identical to backend artifact'
  );

  const wav =
    readWav(
      direct.bytes
    );

  const wantedDuration =
    expectedDuration(entry);

  assert.ok(
    wav.durationSeconds >=
      wantedDuration *
      (
        entry.expect
          ?.minDurationRatio ??
        0.9
      ),
    `${entry.id}: duration ${wav.durationSeconds}s is shorter than expected ${wantedDuration}s`
  );

  assertProviderSpecific(
    entry,
    job,
    wav
  );

  const caseEvidenceDir =
    path.join(
      outputRoot,
      new Date()
        .toISOString()
        .slice(0, 10),
      entry.id
    );

  fs.mkdirSync(
    caseEvidenceDir,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    path.join(
      caseEvidenceDir,
      'result.json'
    ),
    JSON.stringify(
      {
        schemaVersion:
          'harmonia-model-matrix-case-v1',
        caseId: entry.id,
        profile:
          entry.profile,
        purpose:
          entry.purpose,
        model: {
          id: model.id,
          name: model.name,
          providerId:
            model.providerId,
          hardwareFit:
            model.hardwareFit,
          minVramGb:
            model.minVramGb ??
            null,
          recommendedVramGb:
            model.recommendedVramGb ??
            null,
        },
        jobId,
        runtimeModelId:
          job.result?.metadata
            ?.runtimeModelId,
        requestedDurationSeconds:
          wantedDuration,
        wav,
        backendDownloadStatus:
          direct.status,
        frontendDownloadStatus:
          throughFrontend.status,
        sha256:
          directHash,
        parameters:
          entry.parameters,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  fs.writeFileSync(
    path.join(
      caseEvidenceDir,
      'music.wav'
    ),
    direct.bytes
  );

  const latestSamplesDir =
    path.join(
      outputRoot,
      'latest-samples'
    );

  fs.mkdirSync(
    latestSamplesDir,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    path.join(
      latestSamplesDir,
      entry.id + '.wav'
    ),
    direct.bytes
  );

  console.log(
    `CASE_GREEN ${entry.id} ` +
    `${wav.channels}ch ` +
    `${wav.sampleRate}Hz ` +
    `${wav.durationSeconds.toFixed(2)}s`
  );

  return {
    caseId: entry.id,
    modelId: entry.modelId,
    jobId,
    wav,
    sha256:
      directHash,
  };
}

async function main() {
  console.log(
    '============================================================'
  );
  console.log(
    ' HARMONIA HARDWARE MODEL MATRIX'
  );
  console.log(
    '============================================================'
  );
  console.log(
    `mode     = ${
      planOnly
        ? 'PLAN ONLY'
        : 'LIVE GENERATION'
    }`
  );
  console.log(
    `profile  = ${requestedProfile}`
  );
  console.log(
    `backend  = ${backendBase}`
  );
  console.log(
    `frontend = ${frontendBase}`
  );

  if (listOnly) {
    console.log('');
    console.log(
      '=== QUALIFICATION CASES ==='
    );

    const modelIds =
      [...new Set(
        cases.map(
          (entry) =>
            entry.modelId
        )
      )];

    for (
      const modelId of
      modelIds
    ) {
      console.log('');
      console.log(modelId);

      for (
        const entry of
        cases.filter(
          (candidate) =>
            candidate.modelId ===
            modelId
        )
      ) {
        console.log(
          '  ' +
          entry.profile.padEnd(7) +
          ' ' +
          entry.id
        );
      }
    }

    console.log(
      'MODEL_HARDWARE_MATRIX_LIST_GREEN'
    );
    return;
  }

  const catalog =
    (
      await request(
        `${backendBase}/api/music/runtime/catalog`
      )
    ).body;

  const hardware =
    catalog.hardware;

  console.log('');
  console.log(
    'Detected hardware:'
  );
  console.log(
    JSON.stringify(
      hardware,
      null,
      2
    )
  );

  let runnable =
    catalog.models.filter(
      fitIsRunnable
    );

  const hardwareCapableButUnavailable =
    catalog.models.filter(
      (model) =>
        (
          model.hardwareFit ===
            'recommended' ||
          model.hardwareFit ===
            'supported'
        ) &&
        !fitIsRunnable(model)
    );

  const unsupported =
    catalog.models.filter(
      (model) =>
        model.hardwareFit ===
        'unsupported'
    );

  const exactCase =
    requestedCaseId
      ? cases.find(
          (entry) =>
            entry.id ===
            requestedCaseId
        ) || null
      : null;

  if (
    requestedCaseId &&
    !exactCase
  ) {
    throw new Error(
      'Unknown qualification case: ' +
      requestedCaseId
    );
  }

  if (
    requestedModelId &&
    exactCase &&
    exactCase.modelId !==
      requestedModelId
  ) {
    throw new Error(
      'Case ' +
      requestedCaseId +
      ' belongs to ' +
      exactCase.modelId +
      ', not ' +
      requestedModelId
    );
  }

  const targetModelId =
    requestedModelId ||
    exactCase?.modelId ||
    null;

  if (targetModelId) {
    const targetModel =
      catalog.models.find(
        (model) =>
          model.id ===
          targetModelId
      );

    if (!targetModel) {
      throw new Error(
        'Unknown model: ' +
        targetModelId
      );
    }

    if (!fitIsRunnable(targetModel)) {
      throw new Error(
        'Model ' +
        targetModelId +
        ' is not runnable: ' +
        (
          targetModel.disabledReason ||
          targetModel.hardwareFit
        )
      );
    }

    runnable = [
      targetModel,
    ];
  }
  console.log('');
  console.log(
    '=== RUNNABLE NOW ==='
  );

  for (const model of runnable) {
    console.log(
      [
        model.id,
        `fit=${model.hardwareFit}`,
        `availability=${model.availability}`,
        `selectable=${model.selectable}`,
        `min=${model.minVramGb ?? '?'}GB`,
        `recommended=${
          model.recommendedVramGb ??
          '?'
        }GB`,
      ].join('  ')
    );
  }

  console.log('');
  console.log(
    '=== HARDWARE-CAPABLE BUT RUNTIME/AVAILABILITY BLOCKED ==='
  );

  for (
    const model of
    hardwareCapableButUnavailable
  ) {
    console.log(
      [
        model.id,
        `fit=${model.hardwareFit}`,
        `availability=${model.availability}`,
        `selectable=${model.selectable}`,
        `reason=${
          model.disabledReason ||
          'none'
        }`,
      ].join('  ')
    );
  }

  console.log('');
  console.log(
    '=== HARDWARE UNSUPPORTED ==='
  );

  for (const model of unsupported) {
    console.log(
      [
        model.id,
        `min=${model.minVramGb ?? '?'}GB`,
        `recommended=${
          model.recommendedVramGb ??
          '?'
        }GB`,
      ].join('  ')
    );
  }

  assert.ok(
    runnable.length > 0,
    'Detected hardware has no runnable installed models'
  );

  for (const model of runnable) {
    const smoke =
      cases.filter(
        (entry) =>
          entry.modelId ===
            model.id &&
          entry.profile ===
            'smoke'
      );

    const deep =
      cases.filter(
        (entry) =>
          entry.modelId ===
            model.id &&
          entry.profile ===
            'deep'
      );

    assert.ok(
      smoke.length > 0,
      `Runnable model ${model.id} has no smoke qualification case`
    );

    assert.ok(
      deep.length > 0,
      `Runnable model ${model.id} has no deep qualification case`
    );
  }

  const matrixPlan = {
    schemaVersion:
      'harmonia-model-matrix-plan-v1',
    generatedAt:
      new Date().toISOString(),
    hardware,
    profile:
      requestedProfile,
    runnableModels:
      runnable,
    hardwareCapableButUnavailable,
    unsupportedModels:
      unsupported,
    selectedCases:
      runnable.flatMap(
        (model) =>
          profileCasesFor(
            model.id
          ).map(
            (entry) => ({
              id: entry.id,
              profile:
                entry.profile,
              modelId:
                entry.modelId,
              title:
                entry.title,
              purpose:
                entry.purpose,
            })
          )
      ),
  };

  fs.mkdirSync(
    outputRoot,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    path.join(
      outputRoot,
      'latest-plan.json'
    ),
    JSON.stringify(
      matrixPlan,
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log('');
  console.log(
    `selected cases = ${
      matrixPlan
        .selectedCases
        .length
    }`
  );

  if (planOnly) {
    console.log(
      'MODEL_HARDWARE_MATRIX_PLAN_GREEN'
    );
    return;
  }

  const auth =
    await createAuthSession();

  await auth.getToken();

  const results = [];

  try {
    for (
      const model of runnable
    ) {
      for (
        const entry of
        profileCasesFor(
          model.id
        )
      ) {
        results.push(
          await runCase(
            entry,
            model,
            auth
          )
        );
      }
    }
  } finally {
    await authorizedRequest(
      auth,
      `${backendBase}/api/music/runtime/stop`,
      {
        method: 'POST',
      },
      120000
    ).catch(
      () => undefined
    );
  }
  const summaryPath =
    path.join(
      outputRoot,
      `matrix-${new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          '-'
        )}.json`
    );

  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        schemaVersion:
          'harmonia-model-matrix-run-v1',
        hardware,
        profile:
          requestedProfile,
        results,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  console.log('');
  console.log(
    '============================================================'
  );
  console.log(
    ' MODEL HARDWARE MATRIX: GREEN'
  );
  console.log(
    '============================================================'
  );
  console.log(
    `models=${runnable.length}`
  );
  console.log(
    `cases=${results.length}`
  );
  console.log(
    `summary=${path.relative(
      root,
      summaryPath
    )}`
  );
  console.log(
    'MODEL_HARDWARE_MATRIX_GREEN'
  );
}

main().catch(
  (error) => {
    console.error('');
    console.error(
      'MODEL_HARDWARE_MATRIX_FAILED'
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
