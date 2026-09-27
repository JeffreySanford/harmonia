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

/*
 * Load the real TypeScript JobsService without booting the
 * complete Nest application. This exercises the exact C2
 * reconciliation implementation while preventing a generation
 * processor from being registered by this qualification process.
 */
process.env.TS_NODE_TRANSPILE_ONLY =
  'true';

process.env.TS_NODE_COMPILER_OPTIONS =
  JSON.stringify({
    module: 'CommonJS',
    moduleResolution: 'Node',
    target: 'ES2022',
    experimentalDecorators: true,
    useDefineForClassFields: false,
    esModuleInterop: true,
  });

require('reflect-metadata');
require('ts-node/register/transpile-only');

/*
 * JobsService imports the decorated JobRecord schema because Nest uses
 * JobRecord.name in @InjectModel(). Loading that schema directly through
 * plain ts-node is not equivalent to Harmonia's Nest build pipeline:
 * union-valued @Prop fields can be reported as ambiguous before this
 * qualification even reaches reconciliation.
 *
 * C3 does not exercise schema construction. It supplies its own real
 * Mongoose model against the production "jobs" collection below. Stub only
 * the schema module's runtime exports so the real JobsService class can load
 * without asking ts-node to reconstruct Nest/Mongoose decorator metadata.
 */
const Module =
  require('node:module');

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
  JobRecordSchema: {},
};

require.cache[jobSchemaPath] =
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

function readDotEnv() {
  const envPath =
    path.join(
      process.cwd(),
      '.env'
    );

  if (!fs.existsSync(envPath)) {
    return {};
  }

  const result = {};

  for (
    const rawLine of
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
  ) {
    let line =
      rawLine.trim();

    if (
      !line ||
      line.startsWith('#')
    ) {
      continue;
    }

    if (line.startsWith('export ')) {
      line =
        line.slice(7).trim();
    }

    const equalIndex =
      line.indexOf('=');

    if (equalIndex <= 0) {
      continue;
    }

    const key =
      line
        .slice(0, equalIndex)
        .trim();

    let value =
      line
        .slice(equalIndex + 1)
        .trim();

    if (
      (
        value.startsWith('"') &&
        value.endsWith('"')
      ) ||
      (
        value.startsWith("'") &&
        value.endsWith("'")
      )
    ) {
      const quote =
        value[0];

      value =
        value.slice(1, -1);

      if (quote === '"') {
        value =
          value
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
      }
    }

    result[key] = value;
  }

  return result;
}

const fileEnv =
  readDotEnv();

function envValue(name) {
  const direct =
    process.env[name];

  if (
    typeof direct === 'string' &&
    direct.trim()
  ) {
    return direct.trim();
  }

  const fromFile =
    fileEnv[name];

  if (
    typeof fromFile === 'string' &&
    fromFile.trim()
  ) {
    return fromFile.trim();
  }

  return null;
}

function mongoUri() {
  const explicit =
    envValue('MONGODB_URI');

  if (explicit) {
    return explicit;
  }

  const password =
    envValue(
      'MONGO_HARMONIA_PASSWORD'
    );

  if (!password) {
    throw new Error(
      'MONGO_HARMONIA_PASSWORD or MONGODB_URI is required for C3 qualification.'
    );
  }

  return (
    'mongodb://harmonia_app:' +
    encodeURIComponent(password) +
    '@127.0.0.1:27017/harmonia?authSource=harmonia'
  );
}

const redisHost =
  envValue('REDIS_HOST') ||
  '127.0.0.1';

const redisPort =
  Number(
    envValue('REDIS_PORT') ||
      '6379'
  );

assert.ok(
  Number.isInteger(redisPort) &&
  redisPort > 0,
  'REDIS_PORT must be a valid positive integer'
);

const redis = {
  host: redisHost,
  port: redisPort,
};

const probeId =
  new mongoose.Types.ObjectId();

const userId =
  new mongoose.Types.ObjectId();

const jobId =
  probeId.toString();

const userIdText =
  userId.toString();

const marker =
  [
    'm17-c3-recovery',
    Date.now(),
    process.pid,
  ].join('-');

let connection = null;
let generationQueue = null;
let JobModel = null;

let queueWasPaused = false;
let queuePauseChanged = false;

let addCalls = 0;

async function queueLiveCounts(queue) {
  const counts =
    await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'paused'
    );

  return {
    waiting:
      Number(counts.waiting || 0),
    active:
      Number(counts.active || 0),
    delayed:
      Number(counts.delayed || 0),
    paused:
      Number(counts.paused || 0),
  };
}

function totalLiveCounts(counts) {
  return (
    counts.waiting +
    counts.active +
    counts.delayed +
    counts.paused
  );
}

async function removeProbeQueueJob() {
  if (!generationQueue) {
    return;
  }

  const job =
    await generationQueue
      .getJob(jobId)
      .catch(() => null);

  if (job) {
    await job
      .remove()
      .catch(() => undefined);
  }
}

async function removeProbeMongoJob() {
  if (!JobModel) {
    return;
  }

  await JobModel
    .deleteOne({
      _id: probeId,
    })
    .exec()
    .catch(() => undefined);
}

async function restoreQueuePauseState() {
  if (
    generationQueue &&
    queuePauseChanged &&
    !queueWasPaused
  ) {
    await generationQueue
      .resume()
      .catch(() => undefined);

    queuePauseChanged = false;
  }
}

async function closeQuietly() {
  if (generationQueue) {
    await generationQueue
      .close()
      .catch(() => undefined);
  }

  if (connection) {
    await connection
      .close()
      .catch(() => undefined);
  }
}

async function main() {
  console.log(
    'queue_name=generation'
  );

  console.log(
    `redis=${redisHost}:${redisPort}`
  );

  /*
   * Connect through the exact application credential contract.
   * Never print the URI because it may contain credentials.
   */
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
          required: true,
        },
        jobType: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          required: true,
        },
        priority: {
          type: Number,
          default: 0,
        },
        modelId: {
          type: String,
        },
        datasetId: {
          type: String,
        },
        parameters: {
          type:
            mongoose.Schema.Types.Mixed,
          default: {},
        },
        progress: {
          type:
            mongoose.Schema.Types.Mixed,
          default: null,
        },
        result: {
          type:
            mongoose.Schema.Types.Mixed,
          default: null,
        },
        startedAt: {
          type: Date,
          default: null,
        },
        completedAt: {
          type: Date,
          default: null,
        },
        estimatedDuration: {
          type: Number,
          default: null,
        },
      },
      {
        collection: 'jobs',
        timestamps: true,
        strict: false,
      }
    );

  JobModel =
    connection.model(
      'M17C3RecoveryProbe',
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

  await generationQueue.isReady();

  /*
   * Do not interfere with real work. C3 is permitted to proceed
   * only when Harmonia currently has no live generation work.
   */
  const existingMongo =
    await JobModel
      .countDocuments({
        jobType: 'generate',
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
    'C3 refuses to run while real queued/processing generation records exist'
  );

  const beforeCounts =
    await queueLiveCounts(
      generationQueue
    );

  console.log(
    `preexisting_queue_waiting=${beforeCounts.waiting}`
  );

  console.log(
    `preexisting_queue_active=${beforeCounts.active}`
  );

  console.log(
    `preexisting_queue_delayed=${beforeCounts.delayed}`
  );

  console.log(
    `preexisting_queue_paused=${beforeCounts.paused}`
  );

  assert.equal(
    totalLiveCounts(beforeCounts),
    0,
    'C3 refuses to run while the real generation queue has live jobs'
  );

  queueWasPaused =
    await generationQueue.isPaused();

  console.log(
    `queue_initially_paused=${queueWasPaused}`
  );

  if (!queueWasPaused) {
    /*
     * Global pause prevents any independently running backend
     * worker from consuming the synthetic probe during proof.
     */
    await generationQueue.pause();
    queuePauseChanged = true;
  }

  assert.equal(
    await generationQueue.isPaused(),
    true,
    'generation queue must be paused during C3 proof'
  );

  /*
   * Simulate the durable state left when the backend disappears
   * after Mongo has transitioned the generation to processing
   * but Bull no longer owns a corresponding queue job.
   */
  await JobModel.create({
    _id: probeId,
    userId,
    jobType: 'generate',
    status: 'processing',
    priority: 0,
    modelId:
      'm17-c3-synthetic-recovery-probe',
    parameters: {
      marker,
      qualification: true,
    },
    progress: {
      current: 37,
      total: 100,
      percentage: 37,
      message:
        'Synthetic interrupted generation',
    },
    result: null,
    startedAt:
      new Date(),
    completedAt: null,
    estimatedDuration: null,
  });

  const before =
    await JobModel
      .findById(probeId)
      .lean()
      .exec();

  assert.ok(
    before,
    'synthetic Mongo generation record was not created'
  );

  assert.equal(
    before.status,
    'processing'
  );

  const absentBefore =
    await generationQueue.getJob(
      jobId
    );

  assert.equal(
    absentBefore,
    null,
    'synthetic probe must begin orphaned from Bull'
  );

  console.log(
    `probe_job_id=${jobId}`
  );

  console.log(
    'mongo_status_before=processing'
  );

  console.log(
    'bull_job_before=absent'
  );

  /*
   * Instrument only Queue.add so we can prove that repeated
   * startup reconciliation does not perform a second enqueue.
   * Every operation still targets the real Bull generation queue.
   */
  const queueFacade = {
    isReady:
      (...args) =>
        generationQueue.isReady(
          ...args
        ),

    getJob:
      (...args) =>
        generationQueue.getJob(
          ...args
        ),

    add:
      async (...args) => {
        addCalls += 1;

        return generationQueue.add(
          ...args
        );
      },
  };

  const service =
    new JobsService(
      JobModel,
      {},
      {},
      queueFacade
    );

  /*
   * First startup:
   * processing Mongo record is orphaned, therefore it must be
   * reset to queued and reintroduced to Bull once.
   */
  await service.onModuleInit();

  const recovered =
    await JobModel
      .findById(probeId)
      .lean()
      .exec();

  assert.ok(
    recovered,
    'recovered Mongo record disappeared'
  );

  assert.equal(
    recovered.status,
    'queued'
  );

  assert.equal(
    recovered.startedAt,
    null
  );

  assert.deepEqual(
    recovered.progress,
    {
      current: 0,
      total: 100,
      percentage: 0,
      message:
        'Recovered after backend restart; queued for durable replay',
    }
  );

  assert.equal(
    addCalls,
    1,
    'first reconciliation must enqueue exactly once'
  );

  const recoveredBull =
    await generationQueue.getJob(
      jobId
    );

  assert.ok(
    recoveredBull,
    'Bull did not receive the recovered generation job'
  );

  assert.equal(
    String(recoveredBull.id),
    jobId
  );

  assert.equal(
    recoveredBull.name,
    'generate'
  );

  assert.deepEqual(
    recoveredBull.data,
    {
      jobId,
      userId: userIdText,
    }
  );

  const firstBullState =
    await recoveredBull.getState();

  assert.ok(
    [
      'paused',
      'waiting',
    ].includes(firstBullState),
    `unexpected recovered Bull state: ${firstBullState}`
  );

  console.log(
    `mongo_status_after_first_reconcile=${recovered.status}`
  );

  console.log(
    `bull_state_after_first_reconcile=${firstBullState}`
  );

  console.log(
    `queue_add_calls_after_first_reconcile=${addCalls}`
  );

  /*
   * Second startup:
   * Mongo is still nonterminal, but Bull already owns the stable
   * Mongo identity. The existing Bull job must suppress another add.
   */
  await service.onModuleInit();

  assert.equal(
    addCalls,
    1,
    'second startup reconciliation attempted a duplicate enqueue'
  );

  const sameBullJob =
    await generationQueue.getJob(
      jobId
    );

  assert.ok(
    sameBullJob,
    'Bull job disappeared during duplicate-suppression proof'
  );

  assert.equal(
    String(sameBullJob.id),
    jobId
  );

  const liveJobs =
    await generationQueue.getJobs(
      [
        'waiting',
        'paused',
        'delayed',
        'active',
      ],
      0,
      -1,
      false
    );

  const matching =
    liveJobs.filter(
      (job) =>
        String(job.id) === jobId
    );

  assert.equal(
    matching.length,
    1,
    'generation queue must contain exactly one recovered probe identity'
  );

  console.log(
    `queue_add_calls_after_second_reconcile=${addCalls}`
  );

  console.log(
    `matching_bull_jobs=${matching.length}`
  );

  console.log(
    'M17_C3_LIVE_MONGO_BULL_RECOVERY_GREEN'
  );

  /*
   * Remove only the synthetic probe. Never obliterate the real
   * generation queue because completed/failed application history
   * may legitimately live there.
   */
  await sameBullJob.remove();

  await JobModel
    .deleteOne({
      _id: probeId,
    })
    .exec();

  const mongoAfterCleanup =
    await JobModel
      .findById(probeId)
      .lean()
      .exec();

  const bullAfterCleanup =
    await generationQueue.getJob(
      jobId
    );

  assert.equal(
    mongoAfterCleanup,
    null
  );

  assert.equal(
    bullAfterCleanup,
    null
  );

  console.log(
    'probe_mongo_clean=true'
  );

  console.log(
    'probe_bull_clean=true'
  );

  await restoreQueuePauseState();

  assert.equal(
    await generationQueue.isPaused(),
    queueWasPaused,
    'generation queue pause state was not restored'
  );

  console.log(
    'queue_pause_state_restored=true'
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error?.stack ||
        error?.message ||
        String(error)
      );

      process.exitCode = 1;
    }
  )
  .finally(
    async () => {
      /*
       * Failure cleanup is intentionally narrow and idempotent.
       * Only the uniquely generated C3 probe identity is removed.
       */
      await removeProbeQueueJob();
      await removeProbeMongoJob();
      await restoreQueuePauseState();
      await closeQuietly();
    }
  );
