#!/usr/bin/env node

const assert =
  require('node:assert/strict');

const { spawnSync } =
  require('node:child_process');

const Queue = require('bull');

const redisHost =
  process.env.REDIS_HOST?.trim() ||
  '127.0.0.1';

const redisPort =
  Number(
    process.env.REDIS_PORT?.trim() ||
      '6379'
  );

const redisContainer =
  'harmonia-redis';

const queueName =
  [
    'harmonia-m17-b3',
    Date.now(),
    process.pid,
  ].join('-');

const jobId =
  'm17-b3-durable-probe';

const marker =
  [
    'restart-proof',
    Date.now(),
    process.pid,
  ].join('-');

const payload = {
  kind: 'durability-probe',
  marker,
  jobId,
  purpose:
    'prove Bull job survival across Redis restart',
};

const redis = {
  host: redisHost,
  port: redisPort,
};

function sleep(ms) {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

function docker(args, options = {}) {
  const result =
    spawnSync(
      'docker',
      args,
      {
        encoding: 'utf8',
        windowsHide: true,
        ...options,
      }
    );

  if (result.error) {
    throw new Error(
      `Cannot run docker: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    throw new Error(
      (
        result.stderr ||
        result.stdout ||
        `docker exited ${result.status}`
      ).trim()
    );
  }

  return String(
    result.stdout || ''
  ).trim();
}

async function waitForRedis(
  timeoutMs = 30000
) {
  const deadline =
    Date.now() + timeoutMs;

  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const pong =
        docker([
          'exec',
          redisContainer,
          'redis-cli',
          '--raw',
          'PING',
        ]);

      if (pong === 'PONG') {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(
    'Redis did not become ready after restart' +
      (
        lastError
          ? `: ${lastError.message}`
          : ''
      )
  );
}

async function waitForState(
  queue,
  id,
  expected,
  timeoutMs = 15000
) {
  const deadline =
    Date.now() + timeoutMs;

  let lastState = null;

  while (Date.now() < deadline) {
    const job =
      await queue.getJob(id);

    if (job) {
      lastState =
        await job.getState();

      if (lastState === expected) {
        return job;
      }
    }

    await sleep(100);
  }

  throw new Error(
    `Job ${id} did not reach ${expected}; last state=${lastState}`
  );
}

async function closeQuietly(queue) {
  if (!queue) {
    return;
  }

  await queue.close().catch(
    () => undefined
  );
}

async function obliterateQuietly(queue) {
  if (!queue) {
    return;
  }

  await queue
    .obliterate({
      force: true,
    })
    .catch(
      () => undefined
    );
}

async function main() {
  let producer = null;
  let recoveredQueue = null;

  console.log(
    `queue_name=${queueName}`
  );

  console.log(
    `redis=${redisHost}:${redisPort}`
  );

  try {
    /*
     * Phase 1:
     * Persist a named Bull job while no consumer exists.
     */
    producer =
      new Queue(
        queueName,
        { redis }
      );

    await producer.isReady();

    const created =
      await producer.add(
        'durability-probe',
        payload,
        {
          jobId,
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

    assert.equal(
      String(created.id),
      jobId
    );

    const initialState =
      await created.getState();

    assert.equal(
      initialState,
      'waiting'
    );

    assert.deepEqual(
      created.data,
      payload
    );

    console.log(
      `before_restart_state=${initialState}`
    );

    console.log(
      `before_restart_job_id=${created.id}`
    );

    /*
     * Close every client connection before Redis restart.
     * This proves the job is not surviving in client memory.
     */
    await producer.close();
    producer = null;

    /*
     * Redis is configured appendfsync=everysec. Give AOF
     * one full cadence before performing the real container
     * restart.
     */
    await sleep(1500);

    console.log(
      'restarting_redis=true'
    );

    docker([
      'restart',
      redisContainer,
    ]);

    await waitForRedis();

    console.log(
      'redis_restart_ready=true'
    );

    /*
     * Phase 2:
     * Build an entirely new Bull Queue instance after restart.
     * The original producer no longer exists.
     */
    recoveredQueue =
      new Queue(
        queueName,
        { redis }
      );

    await recoveredQueue.isReady();

    const recovered =
      await recoveredQueue.getJob(
        jobId
      );

    assert.ok(
      recovered,
      'Persisted Bull job was not recovered after Redis restart'
    );

    assert.equal(
      String(recovered.id),
      jobId
    );

    assert.deepEqual(
      recovered.data,
      payload
    );

    const recoveredState =
      await recovered.getState();

    assert.equal(
      recoveredState,
      'waiting'
    );

    console.log(
      `after_restart_state=${recoveredState}`
    );

    console.log(
      `after_restart_job_id=${recovered.id}`
    );

    console.log(
      `payload_marker=${recovered.data.marker}`
    );

    /*
     * Phase 3:
     * Attach the consumer only after Redis has restarted.
     * The pre-restart waiting job must be consumed once.
     */
    let processingCount = 0;

    recoveredQueue.process(
      'durability-probe',
      1,
      async (job) => {
        processingCount += 1;

        assert.equal(
          String(job.id),
          jobId
        );

        assert.deepEqual(
          job.data,
          payload
        );

        return {
          ok: true,
          marker:
            job.data.marker,
        };
      }
    );

    const completed =
      await waitForState(
        recoveredQueue,
        jobId,
        'completed'
      );

    assert.equal(
      processingCount,
      1,
      'Recovered job must execute exactly once'
    );

    assert.deepEqual(
      completed.returnvalue,
      {
        ok: true,
        marker,
      }
    );

    console.log(
      `completed_state=${await completed.getState()}`
    );

    console.log(
      `processing_count=${processingCount}`
    );

    console.log(
      'M17_B3_DURABILITY_PROOF_GREEN'
    );

    /*
     * Qualification queue is intentionally isolated from
     * Harmonia's real "generation" queue. Remove every probe
     * key when finished.
     */
    await completed.remove();

    await recoveredQueue.obliterate({
      force: true,
    });

    const leftover =
      await recoveredQueue.getJob(
        jobId
      );

    assert.equal(
      leftover,
      null
    );

    console.log(
      'qualification_queue_clean=true'
    );
  } finally {
    await obliterateQuietly(
      producer
    );

    await closeQuietly(
      producer
    );

    await obliterateQuietly(
      recoveredQueue
    );

    await closeQuietly(
      recoveredQueue
    );
  }
}

main().catch(
  (error) => {
    console.error(
      error?.stack ||
      error?.message ||
      String(error)
    );

    process.exitCode = 1;
  }
);
