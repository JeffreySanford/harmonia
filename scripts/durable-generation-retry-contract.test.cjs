#!/usr/bin/env node

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const root =
  path.resolve(
    __dirname,
    '..'
  );

function source(relativePath) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath
    ),
    'utf8'
  );
}

const jobsService =
  source(
    'apps/backend/src/jobs/jobs.service.ts'
  );

const generationProcessor =
  source(
    'apps/backend/src/jobs/generation.processor.ts'
  );

const jobSchema =
  source(
    'apps/backend/src/schemas/job-record.schema.ts'
  );

test(
  'generation retry attempt state is persisted in Mongo rather than existing only in Bull',
  () => {
    assert.match(
      jobSchema,
      /generationAttempt/
    );

    assert.match(
      jobSchema,
      /generationMaxAttempts/
    );

    assert.match(
      jobSchema,
      /generationLastError/
    );

    assert.match(
      jobSchema,
      /default:\s*0/
    );

    assert.match(
      jobSchema,
      /default:\s*null/
    );
  }
);

test(
  'generation queue owns one explicit bounded exponential retry policy',
  () => {
    assert.match(
      jobsService,
      /GENERATION_MAX_ATTEMPTS\s*=\s*3/
    );

    assert.match(
      jobsService,
      /GENERATION_RETRY_BASE_DELAY_MS/
    );

    assert.match(
      jobsService,
      /generationQueueOptions\s*\(/
    );

    assert.match(
      jobsService,
      /attempts:\s*GENERATION_MAX_ATTEMPTS/
    );

    assert.match(
      jobsService,
      /backoff:\s*\{[\s\S]*?type:\s*['"]exponential['"][\s\S]*?delay:\s*GENERATION_RETRY_BASE_DELAY_MS/
    );
  }
);

test(
  'normal enqueue and restart reconciliation use the same durable retry options',
  () => {
    const helperCalls =
      jobsService.match(
        /this\.generationQueueOptions\s*\(/g
      ) || [];

    assert.ok(
      helperCalls.length >= 2,
      `expected generationQueueOptions to be used by create and recovery; found ${helperCalls.length}`
    );

    assert.match(
      jobsService,
      /removeOnComplete:\s*false/
    );

    assert.match(
      jobsService,
      /removeOnFail:\s*false/
    );
  }
);

test(
  'Bull attempt context is passed into generation execution',
  () => {
    assert.match(
      generationProcessor,
      /job\.attemptsMade/
    );

    assert.match(
      generationProcessor,
      /job\.opts\.attempts/
    );

    assert.match(
      generationProcessor,
      /attempt:\s*job\.attemptsMade\s*\+\s*1/
    );

    assert.match(
      generationProcessor,
      /maxAttempts/
    );

    assert.match(
      jobsService,
      /GenerationAttemptContext/
    );

    assert.match(
      jobsService,
      /processGenerationJob\s*\([\s\S]*?attemptContext/
    );
  }
);

test(
  'each generation attempt fences stale partial WAV state before provider execution',
  () => {
    assert.match(
      jobsService,
      /clearGenerationArtifact/
    );

    assert.match(
      jobsService,
      /music\.wav/
    );

    assert.match(
      jobsService,
      /fs\.rm\s*\([\s\S]*?force:\s*true/
    );
  }
);

test(
  'non-final provider failure is persisted as queued retry state instead of terminal failed',
  () => {
    assert.match(
      jobsService,
      /prepareGenerationRetry/
    );

    assert.match(
      jobsService,
      /attemptContext\.attempt\s*<\s*attemptContext\.maxAttempts/
    );

    assert.match(
      jobsService,
      /generationLastError/
    );

    assert.match(
      jobsService,
      /status\s*=\s*['"]queued['"]/
    );

    assert.match(
      jobsService,
      /completedAt\s*=\s*null/
    );

    assert.match(
      jobsService,
      /Retrying generation attempt/
    );
  }
);

test(
  'retryable failure is rethrown so Bull actually performs the next durable attempt',
  () => {
    const methodStart =
      jobsService.indexOf(
        'async processGenerationJob'
      );

    assert.ok(
      methodStart >= 0,
      'processGenerationJob is missing'
    );

    const method =
      jobsService.slice(
        methodStart
      );

    const retryIndex =
      method.indexOf(
        'prepareGenerationRetry'
      );

    const throwIndex =
      retryIndex >= 0
        ? method.indexOf(
            'throw error',
            retryIndex
          )
        : -1;

    assert.ok(
      retryIndex >= 0,
      'generation retry preparation is missing'
    );

    assert.ok(
      throwIndex > retryIndex,
      'retryable provider failures must be rethrown after retry state is persisted'
    );
  }
);

test(
  'final exhausted attempt becomes terminal Mongo failed',
  () => {
    const methodStart =
      jobsService.indexOf(
        'async processGenerationJob'
      );

    assert.ok(
      methodStart >= 0
    );

    const method =
      jobsService.slice(
        methodStart
      );

    assert.match(
      method,
      /attemptContext\.attempt\s*<\s*attemptContext\.maxAttempts/
    );

    assert.match(
      method,
      /await this\.fail\s*\(/
    );

    assert.match(
      method,
      /throw error/
    );
  }
);

test(
  'active cancellation remains terminal and is consumed before retry handling',
  () => {
    const methodStart =
      jobsService.indexOf(
        'async processGenerationJob'
      );

    assert.ok(
      methodStart >= 0
    );

    const method =
      jobsService.slice(
        methodStart
      );

    const catchIndex =
      method.indexOf(
        '} catch (error) {'
      );

    assert.ok(
      catchIndex >= 0,
      'generation catch boundary is missing'
    );

    const catchBlock =
      method.slice(
        catchIndex
      );

    const cancellationIndex =
      catchBlock.indexOf(
        'consumeActiveGenerationCancellation'
      );

    const retryIndex =
      catchBlock.indexOf(
        'prepareGenerationRetry'
      );

    assert.ok(
      cancellationIndex >= 0,
      'active cancellation consumption is missing'
    );

    assert.ok(
      retryIndex > cancellationIndex,
      'cancellation must be consumed before retry logic can run'
    );
  }
);

test(
  'terminal redelivery protection remains ahead of all generation execution',
  () => {
    const methodStart =
      jobsService.indexOf(
        'async processGenerationJob'
      );

    assert.ok(
      methodStart >= 0
    );

    const method =
      jobsService.slice(
        methodStart
      );

    const terminalGuard =
      method.indexOf(
        "['completed', 'failed', 'cancelled']"
      );

    const runtimeSelection =
      method.indexOf(
        'this.musicRuntime.selectModel'
      );

    assert.ok(
      terminalGuard >= 0
    );

    assert.ok(
      runtimeSelection > terminalGuard,
      'terminal Mongo states must be ignored before provider/runtime execution'
    );
  }
);
