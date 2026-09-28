#!/usr/bin/env node

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const mongoose =
  require('mongoose');

const Queue =
  require('bull');

const {
  execFile,
} =
  require('node:child_process');

const {
  promisify,
  parseEnv,
} =
  require('node:util');

const {
  authenticateQualificationUser,
  selectRuntimeModel,
} =
  require('./runtime-selection-client.cjs');

const execFileAsync =
  promisify(
    execFile
  );

const root =
  path.resolve(
    __dirname,
    '..'
  );

const backendBase =
  process.env.HARMONIA_QUALIFY_BACKEND_BASE ||
  'http://127.0.0.1:3000';

const modelId =
  'musicgen-small';

const providerId =
  'musicgen';

const providerContainer =
  'harmonia-musicgen';

const providerClient =
  '/workspace/scripts/musicgen_provider_client.py';

const providerBackup =
  '/tmp/m18-a4-musicgen-provider-client.original.py';

const failureSentinel =
  'M18_A4_INTENTIONAL_TRANSIENT_FAILURE';

const requestedDuration =
  8;

const pollMs =
  250;

const firstFailureTimeoutMs =
  90000;

const completionTimeoutMs =
  10 * 60 * 1000;

const providerContainers = [
  'harmonia-diffsinger',
  'harmonia-diffsinger-openutau',
  'harmonia-musicgen',
  'harmonia-stable-audio-3',
  'harmonia-ace-step-1.5',
  'harmonia-diffrhythm',
];

const marker =
  [
    'm18-a4',
    Date.now(),
    process.pid,
  ].join('-');

let connection =
  null;

let generationQueue =
  null;

let token =
  null;

let jobId =
  null;

let originalClientHash =
  null;

let mainSucceeded =
  false;

function sleep(
  ms
) {
  return new Promise(
    (
      resolve
    ) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function readEnv() {
  const envPath =
    path.join(
      root,
      '.env'
    );

  if (
    !fs.existsSync(
      envPath
    )
  ) {
    return {};
  }

  return parseEnv(
    fs.readFileSync(
      envPath,
      'utf8'
    )
  );
}

const fileEnv =
  readEnv();

function envValue(
  name
) {
  const direct =
    process.env[name];

  if (
    typeof direct ===
      'string' &&
    direct.trim()
  ) {
    return direct.trim();
  }

  const fromFile =
    fileEnv[name];

  if (
    typeof fromFile ===
      'string' &&
    fromFile.trim()
  ) {
    return fromFile.trim();
  }

  return null;
}

function mongoUri() {
  const explicit =
    envValue(
      'MONGODB_URI'
    );

  if (explicit) {
    return explicit;
  }

  const password =
    envValue(
      'MONGO_HARMONIA_PASSWORD'
    );

  if (!password) {
    throw new Error(
      'MONGO_HARMONIA_PASSWORD or MONGODB_URI is required.'
    );
  }

  return (
    'mongodb://harmonia_app:' +
    encodeURIComponent(
      password
    ) +
    '@127.0.0.1:27017/harmonia?authSource=harmonia'
  );
}

const redis = {
  host:
    envValue(
      'REDIS_HOST'
    ) ||
    '127.0.0.1',

  port:
    Number(
      envValue(
        'REDIS_PORT'
      ) ||
      '6379'
    ),
};

assert.ok(
  Number.isInteger(
    redis.port
  ) &&
  redis.port > 0,
  'REDIS_PORT must be a positive integer'
);

async function docker(
  args,
  {
    allowFailure = false,
    timeout = 60000,
  } = {}
) {
  try {
    const result =
      await execFileAsync(
        'docker',
        args,
        {
          cwd:
            root,

          windowsHide:
            true,

          timeout,
        }
      );

    return {
      ok: true,
      stdout:
        String(
          result.stdout || ''
        ).trim(),
      stderr:
        String(
          result.stderr || ''
        ).trim(),
    };
  } catch (error) {
    if (allowFailure) {
      return {
        ok: false,
        stdout:
          String(
            error.stdout || ''
          ).trim(),
        stderr:
          String(
            error.stderr ||
              error.message ||
              ''
          ).trim(),
      };
    }

    throw error;
  }
}

async function containerState(
  name
) {
  const result =
    await docker(
      [
        'inspect',
        '-f',
        '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}',
        name,
      ],
      {
        allowFailure:
          true,
      }
    );

  if (!result.ok) {
    return {
      exists: false,
      running: false,
      health: 'missing',
    };
  }

  const [
    running,
    health,
  ] =
    result.stdout.split('|');

  return {
    exists: true,
    running:
      running ===
        'true',
    health:
      health ||
      'none',
  };
}

async function sha256InContainer(
  filePath
) {
  const result =
    await docker([
      'exec',
      providerContainer,
      'sha256sum',
      filePath,
    ]);

  const hash =
    result.stdout
      .split(/\s+/)[0];

  assert.ok(
    /^[a-f0-9]{64}$/i.test(
      hash
    ),
    `Invalid SHA-256 output for ${filePath}`
  );

  return hash;
}

async function containerFileExists(
  filePath
) {
  const result =
    await docker(
      [
        'exec',
        providerContainer,
        'test',
        '-e',
        filePath,
      ],
      {
        allowFailure:
          true,
      }
    );

  return result.ok;
}

async function request(
  url,
  options = {},
  timeoutMs = 30000
) {
  const response =
    await fetch(
      url,
      {
        ...options,
        signal:
          AbortSignal.timeout(
            timeoutMs
          ),
      }
    );

  const text =
    await response.text();

  let body =
    null;

  if (text) {
    try {
      body =
        JSON.parse(
          text
        );
    } catch {
      body =
        text;
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

async function authenticatedRequest(
  pathName,
  options = {},
  timeoutMs = 30000
) {
  assert.ok(
    token,
    'Authentication token is unavailable'
  );

  return request(
    `${backendBase}${pathName}`,
    {
      ...options,
      headers: {
        authorization:
          `Bearer ${token}`,
        ...(
          options.headers ||
          {}
        ),
      },
    },
    timeoutMs
  );
}

async function queueLiveCounts() {
  const [
    waiting,
    active,
    delayed,
    paused,
  ] =
    await Promise.all([
      generationQueue.getWaitingCount(),
      generationQueue.getActiveCount(),
      generationQueue.getDelayedCount(),
      generationQueue.getPausedCount(),
    ]);

  return {
    waiting,
    active,
    delayed,
    paused,
  };
}

function totalLiveCounts(
  counts
) {
  return (
    counts.waiting +
    counts.active +
    counts.delayed +
    counts.paused
  );
}

async function mongoJob() {
  if (
    !connection ||
    !jobId
  ) {
    return null;
  }

  return connection
    .db
    .collection(
      'jobs'
    )
    .findOne({
      _id:
        new mongoose.Types.ObjectId(
          jobId
        ),
    });
}

async function injectOneShotFailure() {
  originalClientHash =
    await sha256InContainer(
      providerClient
    );

  await docker(
    [
      'exec',
      providerContainer,
      'rm',
      '-f',
      providerBackup,
    ],
    {
      allowFailure:
        true,
    }
  );

  await docker([
    'exec',
    providerContainer,
    'cp',
    providerClient,
    providerBackup,
  ]);

  const backupHash =
    await sha256InContainer(
      providerBackup
    );

  assert.equal(
    backupHash,
    originalClientHash,
    'Provider-client backup hash differs from original'
  );

  const wrapper =
    [
      'import os',
      'import sys',
      '',
      `TARGET = ${JSON.stringify(providerClient)}`,
      `BACKUP = ${JSON.stringify(providerBackup)}`,
      `SENTINEL = ${JSON.stringify(failureSentinel)}`,
      '',
      'try:',
      '    os.replace(BACKUP, TARGET)',
      'except Exception as exc:',
      '    print(f"{SENTINEL}: restore failed: {exc}", file=sys.stderr)',
      '    raise',
      '',
      'print(SENTINEL, file=sys.stderr)',
      'sys.exit(73)',
      '',
    ].join('\n');

  const encoded =
    Buffer
      .from(
        wrapper,
        'utf8'
      )
      .toString(
        'base64'
      );

  const python =
    [
      'import base64',
      `p=${JSON.stringify(providerClient)}`,
      `d=base64.b64decode(${JSON.stringify(encoded)})`,
      "open(p,'wb').write(d)",
    ].join(';');

  await docker([
    'exec',
    providerContainer,
    'python3.9',
    '-c',
    python,
  ]);

  const injectedHash =
    await sha256InContainer(
      providerClient
    );

  assert.notEqual(
    injectedHash,
    originalClientHash,
    'Fault wrapper did not replace provider client'
  );

  assert.equal(
    await containerFileExists(
      providerBackup
    ),
    true,
    'Provider-client backup is missing after fault injection'
  );

  console.log(
    `original_provider_client_sha256=${originalClientHash}`
  );

  console.log(
    'one_shot_provider_failure_injected=true'
  );
}

async function restoreProviderClientIfNeeded() {
  const state =
    await containerState(
      providerContainer
    );

  if (
    !state.running
  ) {
    return;
  }

  if (
    await containerFileExists(
      providerBackup
    )
  ) {
    await docker([
      'exec',
      providerContainer,
      'python3.9',
      '-c',
      [
        'import os',
        `os.replace(${JSON.stringify(providerBackup)}, ${JSON.stringify(providerClient)})`,
      ].join(';'),
    ]);

    console.log(
      'cleanup_provider_client_restored=true'
    );
  }

  if (
    originalClientHash
  ) {
    const currentHash =
      await sha256InContainer(
        providerClient
      );

    assert.equal(
      currentHash,
      originalClientHash,
      'Provider client was not restored to its original bytes'
    );
  }
}

async function waitForFirstFailure() {
  const deadline =
    Date.now() +
    firstFailureTimeoutMs;

  let lastFingerprint =
    null;

  while (
    Date.now() <
    deadline
  ) {
    const mongo =
      await mongoJob();

    const bull =
      await generationQueue
        .getJob(
          jobId
        );

    const bullState =
      bull
        ? await bull.getState()
        : 'missing';

    const fingerprint =
      JSON.stringify({
        mongoStatus:
          mongo?.status ||
          null,

        attempt:
          mongo?.generationAttempt ??
          null,

        error:
          mongo?.generationLastError ||
          null,

        bullState,
      });

    if (
      fingerprint !==
      lastFingerprint
    ) {
      console.log(
        `retry_observation=${fingerprint}`
      );

      lastFingerprint =
        fingerprint;
    }

    if (
      mongo?.status ===
        'queued' &&
      mongo?.generationAttempt ===
        1 &&
      mongo?.generationMaxAttempts ===
        3 &&
      typeof mongo?.generationLastError ===
        'string' &&
      mongo.generationLastError.includes(
        failureSentinel
      ) &&
      bullState ===
        'delayed'
    ) {
      console.log(
        'attempt1_failure_observed=true'
      );

      console.log(
        'bull_backoff_state=delayed'
      );

      return {
        mongo,
        bull,
      };
    }

    if (
      mongo &&
      [
        'failed',
        'completed',
        'cancelled',
      ].includes(
        mongo.status
      )
    ) {
      throw new Error(
        `Job became terminal before delayed retry observation: ${mongo.status}`
      );
    }

    await sleep(
      pollMs
    );
  }

  throw new Error(
    'Timed out waiting for attempt 1 transient failure + Bull delayed state.'
  );
}

async function waitForCompletion() {
  const deadline =
    Date.now() +
    completionTimeoutMs;

  let lastFingerprint =
    null;

  let attempt2Observed =
    false;

  while (
    Date.now() <
    deadline
  ) {
    const mongo =
      await mongoJob();

    const bull =
      await generationQueue
        .getJob(
          jobId
        );

    const bullState =
      bull
        ? await bull.getState()
        : 'missing';

    const fingerprint =
      JSON.stringify({
        mongoStatus:
          mongo?.status ||
          null,

        attempt:
          mongo?.generationAttempt ??
          null,

        bullState,

        attemptsMade:
          bull?.attemptsMade ??
          null,
      });

    if (
      fingerprint !==
      lastFingerprint
    ) {
      console.log(
        `completion_observation=${fingerprint}`
      );

      lastFingerprint =
        fingerprint;
    }

    if (
      mongo?.generationAttempt ===
        2
    ) {
      attempt2Observed =
        true;
    }

    if (
      mongo?.status ===
        'completed'
    ) {
      assert.equal(
        attempt2Observed,
        true,
        'Attempt 2 was never observed'
      );

      assert.ok(
        bull,
        'Bull job disappeared before completion'
      );

      assert.equal(
        bullState,
        'completed'
      );

      return {
        mongo,
        bull,
      };
    }

    if (
      mongo &&
      [
        'failed',
        'cancelled',
      ].includes(
        mongo.status
      )
    ) {
      throw new Error(
        `Retry job ended unexpectedly as ${mongo.status}: ${
          mongo?.result?.error ||
          mongo?.generationLastError ||
          'no error'
        }`
      );
    }

    await sleep(
      pollMs
    );
  }

  throw new Error(
    'Timed out waiting for retry attempt 2 completion.'
  );
}

function readWav(
  filePath
) {
  const buffer =
    fs.readFileSync(
      filePath
    );

  assert.ok(
    buffer.length >= 44,
    'Generated WAV is too small'
  );

  assert.equal(
    buffer.toString(
      'ascii',
      0,
      4
    ),
    'RIFF'
  );

  assert.equal(
    buffer.toString(
      'ascii',
      8,
      12
    ),
    'WAVE'
  );

  let offset =
    12;

  let channels =
    0;

  let sampleRate =
    0;

  let bitsPerSample =
    0;

  let byteRate =
    0;

  let dataBytes =
    0;

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
        'Generated WAV contains a truncated chunk'
      );
    }

    if (
      id === 'fmt ' &&
      size >= 16
    ) {
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
    } else if (
      id === 'data'
    ) {
      dataBytes =
        size;
    }

    offset =
      start +
      size +
      (
        size % 2
      );
  }

  assert.ok(
    channels > 0 &&
    sampleRate >= 8000 &&
    bitsPerSample >= 8 &&
    byteRate > 0 &&
    dataBytes > 0,
    'Generated WAV has invalid metadata'
  );

  return {
    bytes:
      buffer.length,

    channels,

    sampleRate,

    bitsPerSample,

    durationSeconds:
      dataBytes /
      byteRate,
  };
}

async function stopRuntimeQuietly() {
  if (!token) {
    return;
  }

  await authenticatedRequest(
    '/api/music/runtime/stop',
    {
      method:
        'POST',
    },
    60000
  ).catch(
    () =>
      undefined
  );
}

async function cleanup() {
  /*
   * If the one-shot wrapper has not yet executed, restore it
   * before any other cleanup.
   */
  await restoreProviderClientIfNeeded()
    .catch(
      (
        error
      ) => {
        console.error(
          `cleanup_restore_error=${error.message}`
        );
      }
    );

  /*
   * Cancel only this qualification job if it remains active.
   */
  if (
    token &&
    jobId
  ) {
    const current =
      await authenticatedRequest(
        `/api/jobs/${jobId}`,
        {},
        10000
      )
        .then(
          (
            result
          ) =>
            result.body
        )
        .catch(
          () =>
            null
        );

    if (
      current &&
      [
        'queued',
        'processing',
      ].includes(
        current.status
      )
    ) {
      await authenticatedRequest(
        `/api/jobs/${jobId}/cancel`,
        {
          method:
            'POST',
        },
        60000
      ).catch(
        () =>
          undefined
      );

      await sleep(
        1500
      );
    }
  }

  await stopRuntimeQuietly();

  /*
   * Remove this qualification's Bull record.
   */
  if (
    generationQueue &&
    jobId
  ) {
    const bull =
      await generationQueue
        .getJob(
          jobId
        )
        .catch(
          () =>
            null
        );

    if (bull) {
      await bull
        .remove()
        .catch(
          () =>
            undefined
        );
    }
  }

  /*
   * Remove this qualification's Mongo record through the API
   * where possible, then defensively remove it directly.
   */
  if (
    token &&
    jobId
  ) {
    await authenticatedRequest(
      `/api/jobs/${jobId}`,
      {
        method:
          'DELETE',
      },
      30000
    ).catch(
      () =>
        undefined
    );
  }

  if (
    connection &&
    jobId
  ) {
    await connection
      .db
      .collection(
        'jobs'
      )
      .deleteOne({
        _id:
          new mongoose.Types.ObjectId(
            jobId
          ),
      })
      .catch(
        () =>
          undefined
      );
  }

  if (jobId) {
    await fs.promises.rm(
      path.join(
        root,
        'exports',
        'jobs',
        jobId
      ),
      {
        recursive:
          true,

        force:
          true,
      }
    );
  }

  if (
    generationQueue
  ) {
    await generationQueue
      .close()
      .catch(
        () =>
          undefined
      );
  }

  if (
    connection
  ) {
    await connection
      .close()
      .catch(
        () =>
          undefined
      );
  }

  console.log(
    'a4_cleanup_complete=true'
  );
}

async function main() {
  console.log(
    '============================================================'
  );

  console.log(
    ' M18-A4 LIVE DURABLE GENERATION RETRY'
  );

  console.log(
    ' ATTEMPT 1 FAILS -> BULL DELAY -> ATTEMPT 2 COMPLETES'
  );

  console.log(
    '============================================================'
  );

  console.log(
    `marker=${marker}`
  );

  /*
   * Core backend must already be available. The surrounding
   * shell runs start:all before entering this qualifier.
   */
  await request(
    `${backendBase}/api/__health`
  );

  const auth =
    await authenticateQualificationUser({
      backendBase,
    });

  token =
    auth.token;

  console.log(
    `authenticated_as=${auth.username}`
  );

  connection =
    await mongoose
      .createConnection(
        mongoUri(),
        {
          serverSelectionTimeoutMS:
            10000,
        }
      )
      .asPromise();

  generationQueue =
    new Queue(
      'generation',
      {
        redis,
      }
    );

  await generationQueue
    .isReady();

  /*
   * Refuse to run beside real generation work.
   */
  const existingMongo =
    await connection
      .db
      .collection(
        'jobs'
      )
      .countDocuments({
        jobType:
          'generate',

        status: {
          $in: [
            'queued',
            'processing',
          ],
        },
      });

  const queueBefore =
    await queueLiveCounts();

  console.log(
    `preexisting_nonterminal_generation_records=${existingMongo}`
  );

  console.log(
    `preexisting_queue_waiting=${queueBefore.waiting}`
  );

  console.log(
    `preexisting_queue_active=${queueBefore.active}`
  );

  console.log(
    `preexisting_queue_delayed=${queueBefore.delayed}`
  );

  console.log(
    `preexisting_queue_paused=${queueBefore.paused}`
  );

  assert.equal(
    existingMongo,
    0,
    'A4 refuses to run beside existing nonterminal generation records'
  );

  assert.equal(
    totalLiveCounts(
      queueBefore
    ),
    0,
    'A4 refuses to run beside existing durable generation work'
  );

  /*
   * Own the provider lifecycle so the container-local fault
   * injection cannot affect an unrelated session.
   */
  for (
    const name of
    providerContainers
  ) {
    const state =
      await containerState(
        name
      );

    console.log(
      `provider_preflight_${name}=${
        state.running
          ? 'running'
          : 'stopped'
      }`
    );

    assert.equal(
      state.running,
      false,
      `A4 refuses to run while ${name} is already running`
    );
  }

  console.log(
    'phase_a=prepare_real_musicgen_runtime'
  );

  const selected =
    await selectRuntimeModel({
      backendBase,
      token,
      modelId,
      expectedProviderId:
        providerId,
      timeoutMs:
        30 * 60 * 1000,
      pollMs:
        2000,
    });

  assert.equal(
    selected.status.state,
    'ready'
  );

  assert.equal(
    selected.status.healthy,
    true
  );

  const readyContainer =
    await containerState(
      providerContainer
    );

  assert.equal(
    readyContainer.running,
    true
  );

  assert.equal(
    readyContainer.health,
    'healthy'
  );

  console.log(
    'runtime_prepared=true'
  );

  /*
   * Replace only the current container's client. The wrapper
   * restores the original file before exiting 73, which makes
   * this fault exactly once.
   */
  console.log(
    'phase_b=inject_one_shot_provider_failure'
  );

  await injectOneShotFailure();

  console.log(
    'phase_c=create_real_durable_job'
  );

  const created =
    await authenticatedRequest(
      '/api/jobs',
      {
        method:
          'POST',

        headers: {
          'content-type':
            'application/json',
        },

        body:
          JSON.stringify({
            jobType:
              'generate',

            modelId,

            parameters: {
              marker,

              qualification:
                true,

              title:
                'M18 A4 Durable Retry Probe',

              prompt:
                'instrumental driving electronic rock with punchy drums, bass, and bright synthesizer',

              duration:
                requestedDuration,

              genre:
                'Electronic Rock',

              mood:
                'Focused',

              bpm:
                116,

              instruments: [
                'synthesizer',
                'bass',
                'drums',
              ],

              vocalsStyle:
                'instrumental',
            },
          }),
      }
    );

  jobId =
    created.body?.id;

  assert.ok(
    jobId,
    `Generation creation returned no id: ${JSON.stringify(created.body)}`
  );

  console.log(
    `job_id=${jobId}`
  );

  /*
   * Attempt 1 must fail through the real MusicGen client launch
   * and become Bull delayed, not Mongo terminal-failed.
   */
  console.log(
    'phase_d=observe_attempt1_transient_failure'
  );

  const firstFailure =
    await waitForFirstFailure();

  assert.equal(
    firstFailure.mongo.result,
    null
  );

  assert.equal(
    firstFailure.mongo.completedAt,
    null
  );

  /*
   * The wrapper restores the exact original provider client
   * before returning code 73.
   */
  assert.equal(
    await containerFileExists(
      providerBackup
    ),
    false,
    'One-shot wrapper did not consume its backup'
  );

  const restoredHash =
    await sha256InContainer(
      providerClient
    );

  assert.equal(
    restoredHash,
    originalClientHash
  );

  console.log(
    'provider_client_restored_after_attempt1=true'
  );

  const artifactPath =
    path.join(
      root,
      'exports',
      'jobs',
      jobId,
      'music.wav'
    );

  assert.equal(
    fs.existsSync(
      artifactPath
    ),
    false,
    'Attempt 1 left a completed-looking WAV behind'
  );

  console.log(
    'attempt1_completed_wav_absent=true'
  );

  /*
   * Bull owns the retry. Do not resubmit the API job.
   */
  console.log(
    'phase_e=wait_for_automatic_attempt2'
  );

  const completed =
    await waitForCompletion();

  assert.equal(
    completed.mongo._id.toString(),
    jobId
  );

  assert.equal(
    completed.mongo.status,
    'completed'
  );

  assert.equal(
    completed.mongo.generationAttempt,
    2
  );

  assert.equal(
    completed.mongo.generationMaxAttempts,
    3
  );

  assert.equal(
    completed.mongo.generationLastError,
    null
  );

  assert.equal(
    completed.mongo.result?.outputPath,
    `/api/jobs/${jobId}/artifact`
  );

  assert.equal(
    completed.bull.attemptsMade,
    1,
    'Bull should record exactly one failed attempt before success'
  );

  const markerCount =
    await connection
      .db
      .collection(
        'jobs'
      )
      .countDocuments({
        'parameters.marker':
          marker,
      });

  assert.equal(
    markerCount,
    1,
    'Automatic retry created a second Mongo job instead of reusing the durable identity'
  );

  assert.equal(
    fs.existsSync(
      artifactPath
    ),
    true,
    'Attempt 2 completed without a durable WAV'
  );

  const wav =
    readWav(
      artifactPath
    );

  assert.ok(
    wav.durationSeconds >=
      requestedDuration * 0.9,
    `Retry WAV is too short: ${wav.durationSeconds.toFixed(2)}s`
  );

  const download =
    await authenticatedRequest(
      `/api/jobs/${jobId}/artifact`,
      {},
      30000
    );

  assert.equal(
    download.response.status,
    200
  );

  mainSucceeded =
    true;

  console.log('');
  console.log(
    '============================================================'
  );

  console.log(
    ' M18-A4 LIVE TRANSIENT RETRY: GREEN'
  );

  console.log(
    '============================================================'
  );

  console.log(
    `job_id=${jobId}`
  );

  console.log(
    'attempt1_status=queued'
  );

  console.log(
    'attempt1_error_persisted=true'
  );

  console.log(
    'bull_delayed_retry_observed=true'
  );

  console.log(
    'attempt2_started_automatically=true'
  );

  console.log(
    `mongo_final=${completed.mongo.status}`
  );

  console.log(
    `mongo_final_attempt=${completed.mongo.generationAttempt}`
  );

  console.log(
    `mongo_max_attempts=${completed.mongo.generationMaxAttempts}`
  );

  console.log(
    `bull_final_state=${await completed.bull.getState()}`
  );

  console.log(
    `bull_attempts_made=${completed.bull.attemptsMade}`
  );

  console.log(
    `duration_seconds=${wav.durationSeconds.toFixed(2)}`
  );

  console.log(
    `channels=${wav.channels}`
  );

  console.log(
    `sample_rate=${wav.sampleRate}`
  );

  console.log(
    `bits_per_sample=${wav.bitsPerSample}`
  );

  console.log(
    `artifact_bytes=${wav.bytes}`
  );

  console.log(
    'same_durable_mongo_job_completed=true'
  );

  console.log(
    'real_provider_used_on_attempt2=true'
  );

  console.log(
    'M18_A4_LIVE_TRANSIENT_RETRY_GREEN'
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error('');
      console.error(
        'M18_A4_LIVE_TRANSIENT_RETRY_FAILED'
      );

      console.error(
        error instanceof Error
          ? error.stack ||
            error.message
          : String(
              error
            )
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await cleanup();

      if (
        mainSucceeded
      ) {
        console.log(
          'M18_A4_CLEANUP_AFTER_GREEN=true'
        );
      }
    }
  );
