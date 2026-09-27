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

require('reflect-metadata');
require('ts-node/register/transpile-only');

/*
 * Plain ts-node does not reconstruct Nest/Mongoose decorator
 * metadata exactly like the normal build. D3 supplies its own
 * real Mongoose model against the real "jobs" collection, so
 * stub only the schema module's runtime export while loading
 * the real JobsService class.
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

  const result = {};

  for (
    const rawLine of
    fs
      .readFileSync(
        envPath,
        'utf8'
      )
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

    if (
      line.startsWith(
        'export '
      )
    ) {
      line =
        line
          .slice(7)
          .trim();
    }

    const equalIndex =
      line.indexOf('=');

    if (
      equalIndex <= 0
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
          equalIndex + 1
        )
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
      value =
        value.slice(
          1,
          -1
        );
    }

    result[key] =
      value;
  }

  return result;
}

const fileEnv =
  readDotEnv();

function envValue(name) {
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
  redisPort > 0,
  'REDIS_PORT must be a positive integer'
);

const redis = {
  host:
    redisHost,
  port:
    redisPort,
};

const firstId =
  new mongoose.Types.ObjectId();

const secondId =
  new mongoose.Types.ObjectId();

const userId =
  new mongoose.Types.ObjectId();

const firstJobId =
  firstId.toString();

const secondJobId =
  secondId.toString();

const userIdText =
  userId.toString();

const marker =
  [
    'm17-d3-cancel',
    Date.now(),
    process.pid,
  ].join('-');

let connection = null;
let generationQueue = null;
let JobModel = null;

let queueWasPaused =
  false;

let queuePauseChanged =
  false;

async function queueLiveCounts(
  queue
) {
  const counts =
    await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'paused'
    );

  return {
    waiting:
      Number(
        counts.waiting || 0
      ),

    active:
      Number(
        counts.active || 0
      ),

    delayed:
      Number(
        counts.delayed || 0
      ),

    paused:
      Number(
        counts.paused || 0
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

async function removeBull(
  id
) {
  if (!generationQueue) {
    return;
  }

  const job =
    await generationQueue
      .getJob(
        id
      )
      .catch(
        () => null
      );

  if (job) {
    await job
      .remove()
      .catch(
        () => undefined
      );
  }
}

async function removeMongo(
  id
) {
  if (!JobModel) {
    return;
  }

  await JobModel
    .deleteOne({
      _id: id,
    })
    .exec()
    .catch(
      () => undefined
    );
}

async function restorePauseState() {
  if (
    generationQueue &&
    queuePauseChanged &&
    !queueWasPaused
  ) {
    await generationQueue
      .resume()
      .catch(
        () => undefined
      );

    queuePauseChanged =
      false;
  }
}

async function closeQuietly() {
  if (generationQueue) {
    await generationQueue
      .close()
      .catch(
        () => undefined
      );
  }

  if (connection) {
    await connection
      .close()
      .catch(
        () => undefined
      );
  }
}

async function cleanup() {
  await removeBull(
    firstJobId
  );

  await removeBull(
    secondJobId
  );

  await removeMongo(
    firstId
  );

  await removeMongo(
    secondId
  );

  await restorePauseState();

  await closeQuietly();
}

async function main() {
  console.log(
    'queue_name=generation'
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
      'M17D3CancellationProbe',
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
   * D3 never interferes with real generation work.
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
    'D3 refuses to run while real nonterminal generation records exist'
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
    totalLiveCounts(
      beforeCounts
    ),
    0,
    'D3 refuses to run while the generation queue contains live jobs'
  );

  queueWasPaused =
    await generationQueue.isPaused();

  console.log(
    `queue_initially_paused=${queueWasPaused}`
  );

  if (!queueWasPaused) {
    /*
     * Global pause prevents an independently running Harmonia
     * backend from consuming the synthetic queue job.
     */
    await generationQueue.pause();

    queuePauseChanged =
      true;
  }

  assert.equal(
    await generationQueue.isPaused(),
    true,
    'generation queue must remain paused throughout D3'
  );

  /*
   * CASE 1:
   * Queued Mongo generation + matching Bull job.
   */
  await JobModel.create({
    _id:
      firstId,

    userId,

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
      prompt:
        'M17 D3 synthetic cancellation probe',
      duration:
        5,
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

  await generationQueue.add(
    'generate',
    {
      jobId:
        firstJobId,
      userId:
        userIdText,
    },
    {
      jobId:
        firstJobId,
      removeOnComplete:
        false,
      removeOnFail:
        false,
    }
  );

  const firstBullBefore =
    await generationQueue.getJob(
      firstJobId
    );

  assert.ok(
    firstBullBefore,
    'D3 failed to create the matching Bull job'
  );

  const firstBullState =
    await firstBullBefore.getState();

  assert.ok(
    [
      'paused',
      'waiting',
    ].includes(
      firstBullState
    ),
    `unexpected Bull state before cancellation: ${firstBullState}`
  );

  const firstMongoBefore =
    await JobModel
      .findById(
        firstId
      )
      .lean()
      .exec();

  assert.equal(
    firstMongoBefore.status,
    'queued'
  );

  console.log(
    `case1_job_id=${firstJobId}`
  );

  console.log(
    `case1_mongo_before=${firstMongoBefore.status}`
  );

  console.log(
    `case1_bull_before=${firstBullState}`
  );

  let getJobCalls =
    0;

  let removeCalls =
    0;

  let statusEvents =
    0;

  let userStatusEvents =
    0;

  const queueFacade = {
    getJob:
      async (id) => {
        getJobCalls +=
          1;

        const realJob =
          await generationQueue.getJob(
            id
          );

        if (!realJob) {
          return null;
        }

        return {
          remove:
            async () => {
              /*
               * Prove live ordering: Mongo must still say queued
               * immediately before the real Bull removal executes.
               */
              const mongoImmediatelyBeforeRemoval =
                await JobModel
                  .findById(
                    id
                  )
                  .lean()
                  .exec();

              assert.ok(
                mongoImmediatelyBeforeRemoval,
                'Mongo probe disappeared before Bull removal'
              );

              assert.equal(
                mongoImmediatelyBeforeRemoval.status,
                'queued',
                'Mongo must remain queued until Bull removal succeeds'
              );

              removeCalls +=
                1;

              await realJob.remove();
            },
        };
      },
  };

  const gateway = {
    emitJobStatus:
      (id, status) => {
        assert.equal(
          id,
          firstJobId
        );

        assert.equal(
          status,
          'cancelled'
        );

        statusEvents +=
          1;
      },

    emitJobStatusToUser:
      (uid, id, status) => {
        assert.equal(
          uid,
          userIdText
        );

        assert.equal(
          id,
          firstJobId
        );

        assert.equal(
          status,
          'cancelled'
        );

        userStatusEvents +=
          1;
      },
  };

  const service =
    new JobsService(
      JobModel,
      gateway,
      {},
      queueFacade
    );

  const cancelled =
    await service.cancel(
      firstJobId,
      userIdText
    );

  assert.equal(
    cancelled.status,
    'cancelled'
  );

  assert.equal(
    getJobCalls,
    1
  );

  assert.equal(
    removeCalls,
    1
  );

  assert.equal(
    statusEvents,
    1
  );

  assert.equal(
    userStatusEvents,
    1
  );

  const firstBullAfter =
    await generationQueue.getJob(
      firstJobId
    );

  assert.equal(
    firstBullAfter,
    null,
    'Bull job still exists after queued cancellation'
  );

  const firstMongoAfter =
    await JobModel
      .findById(
        firstId
      )
      .lean()
      .exec();

  assert.equal(
    firstMongoAfter.status,
    'cancelled'
  );

  assert.ok(
    firstMongoAfter.completedAt
  );

  assert.deepEqual(
    firstMongoAfter.progress,
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

  console.log(
    `case1_bull_remove_calls=${removeCalls}`
  );

  console.log(
    `case1_bull_after=${
      firstBullAfter === null
        ? 'absent'
        : 'present'
    }`
  );

  console.log(
    `case1_mongo_after=${firstMongoAfter.status}`
  );

  console.log(
    'case1_ordering=bull-remove-before-mongo-cancel'
  );

  /*
   * CASE 2:
   * Mongo still says queued, but Bull has already lost the job.
   * Cancellation must still persist.
   */
  await JobModel.create({
    _id:
      secondId,

    userId,

    jobType:
      'generate',

    status:
      'queued',

    priority:
      0,

    modelId:
      'musicgen-small',

    parameters: {
      marker:
        `${marker}-missing-bull`,
      qualification:
        true,
      prompt:
        'M17 D3 missing Bull cancellation probe',
      duration:
        5,
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

  const secondBullBefore =
    await generationQueue.getJob(
      secondJobId
    );

  assert.equal(
    secondBullBefore,
    null
  );

  let secondLookupCalls =
    0;

  const secondQueueFacade = {
    getJob:
      async (id) => {
        secondLookupCalls +=
          1;

        assert.equal(
          id,
          secondJobId
        );

        return generationQueue.getJob(
          id
        );
      },
  };

  const secondGateway = {
    emitJobStatus:
      () => undefined,

    emitJobStatusToUser:
      () => undefined,
  };

  const secondService =
    new JobsService(
      JobModel,
      secondGateway,
      {},
      secondQueueFacade
    );

  const secondCancelled =
    await secondService.cancel(
      secondJobId,
      userIdText
    );

  assert.equal(
    secondLookupCalls,
    1
  );

  assert.equal(
    secondCancelled.status,
    'cancelled'
  );

  const secondMongoAfter =
    await JobModel
      .findById(
        secondId
      )
      .lean()
      .exec();

  assert.equal(
    secondMongoAfter.status,
    'cancelled'
  );

  const secondBullAfter =
    await generationQueue.getJob(
      secondJobId
    );

  assert.equal(
    secondBullAfter,
    null
  );

  console.log(
    `case2_job_id=${secondJobId}`
  );

  console.log(
    'case2_bull_before=absent'
  );

  console.log(
    `case2_mongo_after=${secondMongoAfter.status}`
  );

  console.log(
    'case2_missing_bull_cancel_green=true'
  );

  /*
   * No nonterminal synthetic work may remain.
   */
  const remainingSynthetic =
    await JobModel
      .countDocuments({
        _id: {
          $in: [
            firstId,
            secondId,
          ],
        },

        status: {
          $in: [
            'queued',
            'processing',
          ],
        },
      })
      .exec();

  assert.equal(
    remainingSynthetic,
    0
  );

  console.log(
    'M17_D3_LIVE_QUEUED_CANCELLATION_GREEN'
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

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await cleanup();

      if (JobModel) {
        const firstLeft =
          await JobModel
            .findById(
              firstId
            )
            .lean()
            .exec()
            .catch(
              () => null
            );

        const secondLeft =
          await JobModel
            .findById(
              secondId
            )
            .lean()
            .exec()
            .catch(
              () => null
            );

        console.log(
          `probe1_mongo_clean=${firstLeft === null}`
        );

        console.log(
          `probe2_mongo_clean=${secondLeft === null}`
        );
      }

      console.log(
        `queue_pause_state_restored=${
          !generationQueue ||
          queueWasPaused ||
          !queuePauseChanged
        }`
      );
    }
  );
