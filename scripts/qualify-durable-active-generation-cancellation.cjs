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
} =
  require('node:util');

const execFileAsync =
  promisify(
    execFile
  );

process.env.TS_NODE_TRANSPILE_ONLY =
  'true';

process.env.TS_NODE_COMPILER_OPTIONS =
  JSON.stringify({
    module:
      'CommonJS',
    moduleResolution:
      'Node',
    target:
      'ES2022',
    experimentalDecorators:
      true,
    useDefineForClassFields:
      false,
    esModuleInterop:
      true,
  });

require(
  'reflect-metadata'
);

require(
  'ts-node/register/transpile-only'
);

/*
 * The live M17 qualifiers supply their own real Mongoose model
 * against the real jobs collection because plain ts-node does
 * not reconstruct the decorated application schema metadata.
 */
const Module =
  require(
    'node:module'
  );

const jobSchemaPath =
  require.resolve(
    path.join(
      process.cwd(),
      'apps',
      'backend',
      'src',
      'schemas',
      'job-record.schema.ts'
    )
  );

const schemaStub =
  new Module.Module(
    jobSchemaPath
  );

schemaStub.filename =
  jobSchemaPath;

schemaStub.loaded =
  true;

schemaStub.exports = {
  JobRecord:
    class JobRecord {},

  JobRecordSchema:
    {},
};

require.cache[
  jobSchemaPath
] =
  schemaStub;

const {
  JobsService,
} =
  require(
    path.join(
      process.cwd(),
      'apps',
      'backend',
      'src',
      'jobs',
      'jobs.service.ts'
    )
  );

const {
  MusicRuntimeService,
} =
  require(
    path.join(
      process.cwd(),
      'apps',
      'backend',
      'src',
      'music-runtime',
      'music-runtime.service.ts'
    )
  );

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

async function withTimeout(
  promise,
  timeoutMs,
  label
) {
  let timer =
    null;

  try {
    return await Promise.race([
      promise,

      new Promise(
        (
          _resolve,
          reject
        ) => {
          timer =
            setTimeout(
              () => {
                reject(
                  new Error(
                    `${label} timed out after ${timeoutMs} ms`
                  )
                );
              },
              timeoutMs
            );
        }
      ),
    ]);
  } finally {
    if (
      timer
    ) {
      clearTimeout(
        timer
      );
    }
  }
}

function readDotEnv() {
  const envPath =
    path.join(
      process.cwd(),
      '.env'
    );

  if (
    !fs.existsSync(
      envPath
    )
  ) {
    return {};
  }

  const result =
    {};

  for (
    const rawLine of
    fs
      .readFileSync(
        envPath,
        'utf8'
      )
      .split(
        /\r?\n/
      )
  ) {
    let line =
      rawLine.trim();

    if (
      !line ||
      line.startsWith(
        '#'
      )
    ) {
      continue;
    }

    if (
      line.startsWith(
        'export '
      )
    ) {
      line =
        line
          .slice(
            7
          )
          .trim();
    }

    const equalIndex =
      line.indexOf(
        '='
      );

    if (
      equalIndex <=
      0
    ) {
      continue;
    }

    const key =
      line
        .slice(
          0,
          equalIndex
        )
        .trim();

    let value =
      line
        .slice(
          equalIndex +
            1
        )
        .trim();

    if (
      (
        value.startsWith(
          '"'
        ) &&
        value.endsWith(
          '"'
        )
      ) ||
      (
        value.startsWith(
          "'"
        ) &&
        value.endsWith(
          "'"
        )
      )
    ) {
      value =
        value.slice(
          1,
          -1
        );
    }

    result[
      key
    ] =
      value;
  }

  return result;
}

const fileEnv =
  readDotEnv();

function envValue(
  name
) {
  const direct =
    process.env[
      name
    ];

  if (
    typeof direct ===
      'string' &&
    direct.trim()
  ) {
    return direct.trim();
  }

  const fromFile =
    fileEnv[
      name
    ];

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

  if (
    explicit
  ) {
    return explicit;
  }

  const password =
    envValue(
      'MONGO_HARMONIA_PASSWORD'
    );

  if (
    !password
  ) {
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

const redisHost =
  envValue(
    'REDIS_HOST'
  ) ||
  '127.0.0.1';

const redisPort =
  Number(
    envValue(
      'REDIS_PORT'
    ) ||
    '6379'
  );

assert.ok(
  Number.isInteger(
    redisPort
  ) &&
  redisPort >
    0,
  'REDIS_PORT must be a positive integer'
);

const redis = {
  host:
    redisHost,

  port:
    redisPort,
};

const providerContainers = [
  'harmonia-diffsinger',
  'harmonia-diffsinger-openutau',
  'harmonia-musicgen',
  'harmonia-stable-audio-3',
  'harmonia-ace-step-1.5',
  'harmonia-diffrhythm',
];

const jobObjectId =
  new mongoose.Types.ObjectId();

const userObjectId =
  new mongoose.Types.ObjectId();

const jobId =
  jobObjectId.toString();

const userId =
  userObjectId.toString();

const marker =
  [
    'm17-d6-active-cancel',
    Date.now(),
    process.pid,
  ].join(
    '-'
  );

const exportRoot =
  path.join(
    process.cwd(),
    'exports',
    'jobs',
    jobId
  );

let connection =
  null;

let generationQueue =
  null;

let JobModel =
  null;

let runtime =
  null;

let jobs =
  null;

let workerPromise =
  null;

let workerSettled =
  false;

let workerError =
  null;

let mainSucceeded =
  false;

let runtimeTransitions =
  [];

let failedEvents =
  0;

let completedEvents =
  0;

async function containerState(
  containerName
) {
  try {
    const {
      stdout,
    } =
      await execFileAsync(
        'docker',
        [
          'inspect',
          '--format',
          '{{json .State}}',
          containerName,
        ],
        {
          cwd:
            process.cwd(),

          windowsHide:
            true,

          maxBuffer:
            1024 *
            1024,
        }
      );

    const state =
      JSON.parse(
        String(
          stdout
        ).trim()
      );

    return {
      exists:
        true,

      running:
        Boolean(
          state.Running
        ),

      health:
        state.Health?.Status ||
        null,

      exitCode:
        state.ExitCode ??
        null,
    };
  } catch {
    return {
      exists:
        false,

      running:
        false,

      health:
        null,

      exitCode:
        null,
    };
  }
}

async function dockerTopMusicGen() {
  try {
    const {
      stdout,
    } =
      await execFileAsync(
        'docker',
        [
          'top',
          'harmonia-musicgen',
        ],
        {
          cwd:
            process.cwd(),

          windowsHide:
            true,

          maxBuffer:
            4 *
            1024 *
            1024,
        }
      );

    return String(
      stdout
    );
  } catch {
    return '';
  }
}

async function queueLiveCounts() {
  const counts =
    await generationQueue
      .getJobCounts(
        'waiting',
        'active',
        'delayed',
        'paused'
      );

  return {
    waiting:
      Number(
        counts.waiting ||
        0
      ),

    active:
      Number(
        counts.active ||
        0
      ),

    delayed:
      Number(
        counts.delayed ||
        0
      ),

    paused:
      Number(
        counts.paused ||
        0
      ),
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

async function waitForActiveProviderClient() {
  /*
   * Runtime preparation has already completed before this timer
   * begins. This timer measures only the real generation path.
   */
  const deadline =
    Date.now() +
    2 *
    60 *
    1000;

  let previousMongoStatus =
    null;

  while (
    Date.now() <
    deadline
  ) {
    const mongoJob =
      await JobModel
        .findById(
          jobObjectId
        )
        .lean()
        .exec();

    assert.ok(
      mongoJob,
      'D6 Mongo probe disappeared while waiting for provider execution'
    );

    if (
      mongoJob.status !==
      previousMongoStatus
    ) {
      console.log(
        `mongo_status=${mongoJob.status}`
      );

      previousMongoStatus =
        mongoJob.status;
    }

    if (
      [
        'failed',
        'completed',
        'cancelled',
      ].includes(
        mongoJob.status
      )
    ) {
      throw new Error(
        `D6 job became ${mongoJob.status} before cancellation could be issued`
      );
    }

    const state =
      runtime.status;

    const top =
      await dockerTopMusicGen();

    const clientObserved =
      /musicgen_provider_client\.py/.test(
        top
      );

    if (
      mongoJob.status ===
        'processing' &&
      state?.state ===
        'busy' &&
      clientObserved
    ) {
      console.log(
        'real_provider_client_observed=true'
      );

      return;
    }

    await sleep(
      100
    );
  }

  throw new Error(
    'Timed out waiting for active MusicGen provider client after runtime was already ready.'
  );
}

async function stopMusicGenQuietly() {
  const state =
    await containerState(
      'harmonia-musicgen'
    );

  if (
    !state.running
  ) {
    return;
  }

  await execFileAsync(
    'docker',
    [
      'stop',
      'harmonia-musicgen',
    ],
    {
      cwd:
        process.cwd(),

      windowsHide:
        true,

      timeout:
        30000,
    }
  ).catch(
    () =>
      undefined
  );
}

async function settleWorkerDuringCleanup() {
  if (
    !workerPromise ||
    workerSettled
  ) {
    return;
  }

  /*
   * Prefer the production cancellation path if an active
   * processing probe remains. This lets the worker consume
   * its cancellation intent normally.
   */
  if (
    jobs &&
    JobModel
  ) {
    const current =
      await JobModel
        .findById(
          jobObjectId
        )
        .lean()
        .exec()
        .catch(
          () =>
            null
        );

    if (
      current?.status ===
        'processing' &&
      runtime?.status?.state ===
        'busy'
    ) {
      await withTimeout(
        jobs.cancel(
          jobId,
          userId
        ),
        60000,
        'cleanup cancellation'
      ).catch(
        () =>
          undefined
      );
    }
  }

  await stopMusicGenQuietly();

  await withTimeout(
    workerPromise,
    60000,
    'worker cleanup settlement'
  ).catch(
    () =>
      undefined
  );
}

async function cleanup() {
  /*
   * Critical ordering:
   *
   *   provider/worker settles
   *   -> synthetic Bull cleanup
   *   -> synthetic Mongo cleanup
   *   -> export cleanup
   *   -> close Redis/Mongo clients
   *
   * Never close Mongo while the worker is still running.
   */
  await settleWorkerDuringCleanup();

  await stopMusicGenQuietly();

  if (
    generationQueue
  ) {
    const bullJob =
      await generationQueue
        .getJob(
          jobId
        )
        .catch(
          () =>
            null
        );

    if (
      bullJob
    ) {
      await bullJob
        .remove()
        .catch(
          () =>
            undefined
        );
    }
  }

  if (
    JobModel
  ) {
    await JobModel
      .deleteOne({
        _id:
          jobObjectId,
      })
      .exec()
      .catch(
        () =>
          undefined
      );

    const leftover =
      await JobModel
        .countDocuments({
          _id:
            jobObjectId,
        })
        .exec()
        .catch(
          () =>
            -1
        );

    console.log(
      `cleanup_mongo_clean=${leftover === 0}`
    );
  }

  await fs.promises
    .rm(
      exportRoot,
      {
        recursive:
          true,

        force:
          true,
      }
    )
    .catch(
      () =>
        undefined
    );

  console.log(
    `cleanup_export_clean=${!fs.existsSync(exportRoot)}`
  );

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
    'd6_cleanup_complete=true'
  );
}

async function main() {
  console.log(
    '============================================================'
  );

  console.log(
    ' M17-D6 LIVE ACTIVE GENERATION CANCELLATION'
  );

  console.log(
    ' PREPARE RUNTIME -> GENERATE -> CANCEL'
  );

  console.log(
    '============================================================'
  );

  console.log(
    `job_id=${jobId}`
  );

  console.log(
    `marker=${marker}`
  );

  console.log(
    `redis=${redisHost}:${redisPort}`
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

  const ProbeSchema =
    new mongoose.Schema(
      {
        userId: {
          type:
            mongoose.Schema.Types.ObjectId,

          required:
            true,
        },

        jobType: {
          type:
            String,

          required:
            true,
        },

        status: {
          type:
            String,

          required:
            true,
        },

        priority: {
          type:
            Number,

          default:
            0,
        },

        modelId:
          String,

        datasetId:
          String,

        parameters: {
          type:
            mongoose.Schema.Types.Mixed,

          default:
            {},
        },

        progress: {
          type:
            mongoose.Schema.Types.Mixed,

          default:
            null,
        },

        result: {
          type:
            mongoose.Schema.Types.Mixed,

          default:
            null,
        },

        startedAt: {
          type:
            Date,

          default:
            null,
        },

        completedAt: {
          type:
            Date,

          default:
            null,
        },

        estimatedDuration: {
          type:
            Number,

          default:
            null,
        },
      },
      {
        collection:
          'jobs',

        timestamps:
          true,

        strict:
          false,
      }
    );

  JobModel =
    connection.model(
      'M17D6ActiveCancellationProbe',
      ProbeSchema,
      'jobs'
    );

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
   * Refuse to interfere with real generation work.
   */
  const existingMongo =
    await JobModel
      .countDocuments({
        jobType:
          'generate',

        status: {
          $in: [
            'queued',
            'processing',
          ],
        },
      })
      .exec();

  console.log(
    `preexisting_nonterminal_generation_records=${existingMongo}`
  );

  assert.equal(
    existingMongo,
    0,
    'D6 refuses to run while real nonterminal generation records exist'
  );

  const queueBefore =
    await queueLiveCounts();

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
    totalLiveCounts(
      queueBefore
    ),
    0,
    'D6 refuses to run while durable generation work exists'
  );

  /*
   * D6 owns the provider lifecycle. Never replace an unrelated
   * already-running runtime.
   */
  for (
    const containerName of
    providerContainers
  ) {
    const state =
      await containerState(
        containerName
      );

    console.log(
      `provider_preflight_${containerName}=${
        state.running
          ? 'running'
          : 'stopped'
      }`
    );

    assert.equal(
      state.running,
      false,
      `D6 refuses to run while ${containerName} is already running`
    );
  }

  const runtimeGateway = {
    emitRuntimeStatus:
      (
        status
      ) => {
        runtimeTransitions.push({
          state:
            status.state,

          providerId:
            status.providerId,

          modelId:
            status.modelId,

          at:
            Date.now(),
        });

        console.log(
          `runtime_transition=${status.state} provider=${status.providerId || 'none'} model=${status.modelId || 'none'}`
        );
      },
  };

  /*
   * Model bytes were already verified by models:verify before
   * entering this script. D6 exercises runtime lifecycle, not
   * installation projection.
   */
  const modelInstallations = {
    assertModelReady:
      async (
        modelId
      ) => {
        assert.equal(
          modelId,
          'musicgen-small'
        );
      },

    markModelUsed:
      async (
        modelId
      ) => {
        assert.equal(
          modelId,
          'musicgen-small'
        );
      },

    getCatalogInstallationInfo:
      async () =>
        ({}),
  };

  runtime =
    new MusicRuntimeService(
      runtimeGateway,
      modelInstallations
    );

  /*
   * ============================================================
   * PHASE A — prepare runtime completely.
   *
   * No synthetic Mongo job exists yet, therefore a long Docker
   * cache reconciliation/startup cannot race the cancellation
   * timer or job cleanup.
   * ============================================================
   */

  console.log('');
  console.log(
    'phase_a=prepare_runtime'
  );

  const prepared =
    await runtime.selectModel(
      'musicgen-small'
    );

  assert.equal(
    prepared.state,
    'ready'
  );

  assert.equal(
    prepared.providerId,
    'musicgen'
  );

  assert.equal(
    prepared.modelId,
    'musicgen-small'
  );

  assert.equal(
    prepared.healthy,
    true
  );

  const providerReadyState =
    await containerState(
      'harmonia-musicgen'
    );

  assert.equal(
    providerReadyState.running,
    true
  );

  assert.equal(
    providerReadyState.health,
    'healthy'
  );

  console.log(
    'runtime_prepared=true'
  );

  console.log(
    'runtime_prepared_state=ready'
  );

  /*
   * Preparation transitions are not part of the cancellation
   * sequence we assert later.
   */
  runtimeTransitions =
    [];

  /*
   * ============================================================
   * PHASE B — create synthetic job only after runtime is ready.
   * ============================================================
   */

  const jobGateway = {
    emitJobStatus:
      (
        id,
        status
      ) => {
        if (
          id ===
          jobId
        ) {
          console.log(
            `job_status_event=${status}`
          );
        }
      },

    emitJobStatusToUser:
      () =>
        undefined,

    emitJobProgress:
      (
        id,
        progress
      ) => {
        if (
          id ===
          jobId
        ) {
          console.log(
            `job_progress=${progress.percentage} message=${progress.message}`
          );
        }
      },

    emitJobCompleted:
      () => {
        completedEvents +=
          1;
      },

    emitJobFailed:
      () => {
        failedEvents +=
          1;
      },
  };

  jobs =
    new JobsService(
      JobModel,
      jobGateway,
      runtime,
      generationQueue
    );

  await JobModel.create({
    _id:
      jobObjectId,

    userId:
      userObjectId,

    jobType:
      'generate',

    status:
      'queued',

    priority:
      0,

    modelId:
      'musicgen-small',

    parameters: {
      marker,

      qualification:
        true,

      title:
        'M17 D6 Active Cancellation Probe',

      prompt:
        'instrumental electronic rock with steady drums and synthesizer',

      /*
       * Deliberately long. D6 cancels immediately after observing
       * the real provider client; it does not wait for this audio.
       */
      duration:
        120,

      genre:
        'Electronic Rock',

      mood:
        'Focused',

      bpm:
        112,

      instruments: [
        'synthesizer',
        'bass',
        'drums',
      ],

      vocalsStyle:
        'instrumental',
    },

    progress: {
      current:
        0,

      total:
        100,

      percentage:
        0,

      message:
        'Queued',
    },

    result:
      null,

    startedAt:
      null,

    completedAt:
      null,

    estimatedDuration:
      null,
  });

  console.log(
    'phase_b_probe_mongo_created=true'
  );

  /*
   * ============================================================
   * PHASE C — execute the actual worker in this same process.
   *
   * This is intentional. D5 active cancellation coordination is
   * a process-local Set, so cancel() and processGenerationJob()
   * must share the same JobsService process.
   * ============================================================
   */

  console.log(
    'phase_c=start_real_generation'
  );

  workerPromise =
    jobs
      .processGenerationJob(
        jobId,
        userId
      )
      .then(
        () => {
          workerSettled =
            true;
        }
      )
      .catch(
        (
          error
        ) => {
          workerError =
            error;

          workerSettled =
            true;
        }
      );

  await waitForActiveProviderClient();

  /*
   * Give the observed docker exec a short window to enter the
   * provider request. The actual cancellation remains immediate
   * relative to a 120-second requested generation.
   */
  await sleep(
    500
  );

  const immediatelyBeforeCancel =
    await JobModel
      .findById(
        jobObjectId
      )
      .lean()
      .exec();

  assert.ok(
    immediatelyBeforeCancel
  );

  assert.equal(
    immediatelyBeforeCancel.status,
    'processing'
  );

  assert.equal(
    runtime.status.state,
    'busy'
  );

  assert.equal(
    runtime.status.providerId,
    'musicgen'
  );

  console.log(
    'cancel_requested_while_mongo_processing=true'
  );

  console.log(
    'cancel_requested_while_runtime_busy=true'
  );

  /*
   * ============================================================
   * PHASE D — production cancellation path.
   * ============================================================
   */

  const cancelled =
    await withTimeout(
      jobs.cancel(
        jobId,
        userId
      ),
      60000,
      'active generation cancellation'
    );

  assert.equal(
    cancelled.status,
    'cancelled'
  );

  console.log(
    'cancel_result=cancelled'
  );

  await withTimeout(
    workerPromise,
    60000,
    'cancelled worker settlement'
  );

  if (
    workerError
  ) {
    throw workerError;
  }

  assert.equal(
    workerSettled,
    true
  );

  console.log(
    'worker_settled_without_throw=true'
  );

  /*
   * ============================================================
   * PHASE E — verify stable terminal state.
   * ============================================================
   */

  const mongoAfter =
    await JobModel
      .findById(
        jobObjectId
      )
      .lean()
      .exec();

  assert.ok(
    mongoAfter
  );

  assert.equal(
    mongoAfter.status,
    'cancelled'
  );

  assert.ok(
    mongoAfter.completedAt
  );

  assert.deepEqual(
    mongoAfter.progress,
    {
      current:
        0,

      total:
        100,

      percentage:
        0,

      message:
        'Cancelled',
    }
  );

  assert.ok(
    !mongoAfter.result ||
    !mongoAfter.result.error,
    'intentional provider termination became a failed result'
  );

  assert.ok(
    !mongoAfter.result ||
    !mongoAfter.result.outputPath,
    'cancelled generation exposed a completed artifact'
  );

  /*
   * Give any delayed worker persistence enough time to expose a
   * cancellation-vs-completion/failure race.
   */
  await sleep(
    1500
  );

  const mongoSettled =
    await JobModel
      .findById(
        jobObjectId
      )
      .lean()
      .exec();

  assert.ok(
    mongoSettled
  );

  assert.equal(
    mongoSettled.status,
    'cancelled',
    'worker overwrote cancelled state after settlement'
  );

  assert.ok(
    !mongoSettled.result ||
    !mongoSettled.result.error
  );

  assert.ok(
    !mongoSettled.result ||
    !mongoSettled.result.outputPath
  );

  assert.equal(
    failedEvents,
    0,
    'intentional cancellation emitted a failure event'
  );

  assert.equal(
    completedEvents,
    0,
    'intentional cancellation emitted a completion event'
  );

  assert.equal(
    runtime.status.state,
    'stopped'
  );

  assert.equal(
    runtime.status.providerId,
    null
  );

  assert.equal(
    runtime.status.modelId,
    null
  );

  const providerAfter =
    await containerState(
      'harmonia-musicgen'
    );

  assert.equal(
    providerAfter.running,
    false,
    'MusicGen remains running after active cancellation'
  );

  const states =
    runtimeTransitions.map(
      (
        transition
      ) =>
        transition.state
    );

  console.log(
    `cancellation_runtime_sequence=${states.join('>')}`
  );

  const busyIndex =
    states.indexOf(
      'busy'
    );

  const stoppingIndex =
    states.indexOf(
      'stopping'
    );

  const stoppedIndex =
    states.indexOf(
      'stopped'
    );

  assert.ok(
    busyIndex >=
    0,
    'generation runtime never reached busy'
  );

  assert.ok(
    stoppingIndex >
    busyIndex,
    'runtime did not transition busy -> stopping'
  );

  assert.ok(
    stoppedIndex >
    stoppingIndex,
    'runtime did not transition stopping -> stopped'
  );

  assert.equal(
    states
      .slice(
        stoppedIndex +
          1
      )
      .includes(
        'ready'
      ),
    false,
    'finishGeneration resurrected runtime after cancellation'
  );

  /*
   * The D6 worker is direct/same-process by design. It must not
   * mutate the already-qualified Bull durable queue.
   */
  const bullByProbeId =
    await generationQueue
      .getJob(
        jobId
      );

  assert.equal(
    bullByProbeId,
    null
  );

  const queueAfter =
    await queueLiveCounts();

  assert.equal(
    totalLiveCounts(
      queueAfter
    ),
    0
  );

  assert.equal(
    fs.existsSync(
      path.join(
        exportRoot,
        'music.wav'
      )
    ),
    false,
    'cancelled provider produced a durable completed WAV'
  );

  mainSucceeded =
    true;

  console.log('');
  console.log(
    '============================================================'
  );

  console.log(
    ' M17-D6 LIVE ACTIVE CANCELLATION: GREEN'
  );

  console.log(
    '============================================================'
  );

  console.log(
    `job_id=${jobId}`
  );

  console.log(
    `mongo_final=${mongoSettled.status}`
  );

  console.log(
    `runtime_final=${runtime.status.state}`
  );

  console.log(
    `provider_running=${providerAfter.running}`
  );

  console.log(
    `failed_events=${failedEvents}`
  );

  console.log(
    `completed_events=${completedEvents}`
  );

  console.log(
    'provider_prepared_before_probe=true'
  );

  console.log(
    'real_provider_client_observed=true'
  );

  console.log(
    'real_provider_container_stopped=true'
  );

  console.log(
    'intentional_provider_interruption_suppressed=true'
  );

  console.log(
    'runtime_resurrection=false'
  );

  console.log(
    'mongo_cancelled_stable=true'
  );

  console.log(
    'bull_queue_untouched=true'
  );

  console.log(
    'completed_wav_absent=true'
  );

  console.log(
    'M17_D6_LIVE_ACTIVE_CANCELLATION_GREEN'
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error('');

      console.error(
        'M17_D6_LIVE_ACTIVE_CANCELLATION_FAILED'
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
          'M17_D6_CLEANUP_AFTER_GREEN=true'
        );
      }
    }
  );
