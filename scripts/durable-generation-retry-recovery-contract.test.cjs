#!/usr/bin/env node

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const test =
  require('node:test');

const root =
  path.resolve(
    __dirname,
    '..'
  );

function read(
  relativePath
) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath
    ),
    'utf8'
  );
}

const jobsService =
  read(
    'apps/backend/src/jobs/jobs.service.ts'
  );

const processor =
  read(
    'apps/backend/src/jobs/generation.processor.ts'
  );

/*
 * A Bull job recreated after restart has attemptsMade=0 again.
 *
 * Therefore the durable Mongo generationAttempt must become an
 * explicit offset in the Bull payload. The processor must combine:
 *
 * persisted attempt offset
 * + Bull-local attemptsMade
 * + current attempt
 *
 * to recover the absolute generation attempt number.
 */
test(
  'Bull generation payload carries persisted attempt offset and total attempt budget',
  () => {
    assert.match(
      processor,
      /interface\s+GenerationJobData\s*\{[\s\S]*attemptOffset:\s*number[\s\S]*maxAttempts:\s*number[\s\S]*\}/
    );

    assert.match(
      processor,
      /job\.data\.attemptOffset/
    );

    assert.match(
      processor,
      /job\.data\.maxAttempts/
    );
  }
);

test(
  'processor derives absolute generation attempt after Bull recreation',
  () => {
    assert.match(
      processor,
      /attempt:\s*job\.data\.attemptOffset\s*\+\s*job\.attemptsMade\s*\+\s*1/
    );

    assert.match(
      processor,
      /maxAttempts:\s*job\.data\.maxAttempts/
    );
  }
);

/*
 * A newly-created job still receives the entire retry budget.
 *
 * Recovered jobs, however, must be allowed to request only the
 * number of Bull attempts that remain.
 */
test(
  'generation queue options accept an explicit remaining-attempt count',
  () => {
    assert.match(
      jobsService,
      /generationQueueOptions\s*\(\s*jobId:\s*string,\s*attempts:\s*number\s*=\s*GENERATION_MAX_ATTEMPTS/
    );

    assert.match(
      jobsService,
      /attempts,\s*backoff:\s*\{/
    );
  }
);

test(
  'fresh generation enqueue begins at offset zero with the full retry budget',
  () => {
    assert.match(
      jobsService,
      /jobId:\s*result\.id,[\s\S]*userId,[\s\S]*attemptOffset:\s*0,[\s\S]*maxAttempts:\s*GENERATION_MAX_ATTEMPTS/
    );

    assert.match(
      jobsService,
      /generationQueueOptions\s*\(\s*result\.id,\s*GENERATION_MAX_ATTEMPTS\s*\)/
    );
  }
);

/*
 * Mongo is the durable authority for attempts already consumed.
 *
 * Older jobs written before M18 may not contain these properties,
 * so recovery must safely fall back to 0 / GENERATION_MAX_ATTEMPTS.
 */
test(
  'restart recovery derives a sanitized plan from persisted Mongo retry metadata',
  () => {
    assert.match(
      jobsService,
      /generationRecoveryPlan\s*\(/
    );

    assert.match(
      jobsService,
      /generationAttempt/
    );

    assert.match(
      jobsService,
      /generationMaxAttempts/
    );

    assert.match(
      jobsService,
      /GENERATION_MAX_ATTEMPTS/
    );

    assert.match(
      jobsService,
      /attemptOffset/
    );

    assert.match(
      jobsService,
      /remainingAttempts/
    );
  }
);

/*
 * Example:
 *
 * Mongo generationAttempt=1
 * Mongo generationMaxAttempts=3
 *
 * means attempt 1 is consumed.
 *
 * Recreated Bull job:
 *   attemptOffset=1
 *   maxAttempts=3
 *   opts.attempts=2
 *
 * First execution after restart is therefore absolute attempt 2.
 */
test(
  'orphaned retry work resumes from persisted offset with only remaining Bull attempts',
  () => {
    assert.match(
      jobsService,
      /attemptOffset:\s*(?:recovery|plan)\.attemptOffset/
    );

    assert.match(
      jobsService,
      /maxAttempts:\s*(?:recovery|plan)\.maxAttempts/
    );

    assert.match(
      jobsService,
      /generationQueueOptions\s*\(\s*jobId,\s*(?:recovery|plan)\.remainingAttempts\s*\)/
    );
  }
);

/*
 * If Mongo already says the last allowed attempt was consumed,
 * startup must not manufacture a fourth attempt.
 */
test(
  'restart recovery terminally fails an orphan whose retry budget is exhausted',
  () => {
    assert.match(
      jobsService,
      /remainingAttempts\s*<=\s*0/
    );

    assert.match(
      jobsService,
      /retry budget exhausted/i
    );

    assert.match(
      jobsService,
      /status\s*=\s*['"]failed['"]/
    );

    assert.match(
      jobsService,
      /completedAt\s*=\s*new Date\s*\(\s*\)/
    );

    assert.match(
      jobsService,
      /continue\s*;/
    );
  }
);

/*
 * A processing job interrupted by backend death consumed the
 * attempt whose number was persisted when processing began.
 *
 * With budget remaining it returns to queued, but its progress
 * must identify the next absolute attempt rather than claiming
 * a brand-new first attempt.
 */
test(
  'orphaned processing recovery reports the next absolute retry attempt',
  () => {
    assert.match(
      jobsService,
      /status\s*===\s*['"]processing['"]/
    );

    assert.match(
      jobsService,
      /Recovered after backend restart/
    );

    assert.match(
      jobsService,
      /attemptOffset\s*\+\s*1/
    );

    assert.match(
      jobsService,
      /maxAttempts/
    );
  }
);
