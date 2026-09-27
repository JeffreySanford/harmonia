const fs =
  require('node:fs');

const path =
  require('node:path');

const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const jobsPath =
  path.join(
    root,
    'apps',
    'backend',
    'src',
    'jobs',
    'jobs.service.ts'
  );

const runtimePath =
  path.join(
    root,
    'apps',
    'backend',
    'src',
    'music-runtime',
    'music-runtime.service.ts'
  );

const jobs =
  fs.readFileSync(
    jobsPath,
    'utf8'
  );

const runtime =
  fs.readFileSync(
    runtimePath,
    'utf8'
  );

function block(
  source,
  startNeedle,
  endNeedle
) {
  const start =
    source.indexOf(
      startNeedle
    );

  assert.ok(
    start >= 0,
    `${startNeedle} must exist`
  );

  const end =
    source.indexOf(
      endNeedle,
      start +
        startNeedle.length
    );

  assert.ok(
    end > start,
    `${endNeedle} must follow ${startNeedle}`
  );

  return source.slice(
    start,
    end
  );
}

test(
  'music runtime already has a real provider stop primitive',
  () => {
    const stop =
      block(
        runtime,
        'async stopCurrentRuntime(',
        'private async ensureProviderImage'
      );

    assert.match(
      stop,
      /this\.compose\s*\(\s*provider,\s*\[['"]stop['"],\s*provider\.dockerService\]\s*\)/
    );

    assert.match(
      stop,
      /['"]stopped['"]/
    );
  }
);

test(
  'runtime exposes provider-specific generation cancellation',
  () => {
    assert.match(
      runtime,
      /async cancelGeneration\s*\(\s*providerId:\s*string\s*\)/
    );

    const cancel =
      block(
        runtime,
        'async cancelGeneration(',
        'async stopCurrentRuntime('
      );

    assert.match(
      cancel,
      /reconcileRuntimeOwnership/
    );

    assert.match(
      cancel,
      /this\.status\.providerId\s*!==\s*providerId/
    );

    assert.match(
      cancel,
      /stopCurrentRuntime\s*\(/
    );
  }
);

test(
  'finishGeneration never resurrects a stopping or stopped provider',
  () => {
    const finish =
      block(
        runtime,
        'async finishGeneration(',
        'requestModelSelection('
      );

    assert.match(
      finish,
      /\[['"]stopping['"],\s*['"]stopped['"]\]\.includes\s*\(\s*this\.status\.state\s*\)/
    );

    const stoppedGuard =
      finish.search(
        /\[['"]stopping['"],\s*['"]stopped['"]\]\.includes/
      );

    const transition =
      finish.indexOf(
        'this.transition'
      );

    assert.ok(
      stoppedGuard >= 0,
      'stopping/stopped guard must exist'
    );

    assert.ok(
      transition >= 0,
      'ready transition must remain available for normal completion'
    );

    assert.ok(
      stoppedGuard < transition,
      'stopping/stopped guard must precede ready transition'
    );
  }
);

test(
  'JobsService tracks in-process active cancellation intent',
  () => {
    assert.match(
      jobs,
      /private readonly activeGenerationCancellations\s*=\s*new Set<string>\s*\(\s*\)/
    );

    assert.match(
      jobs,
      /private consumeActiveGenerationCancellation\s*\(\s*jobId:\s*string\s*\):\s*boolean/
    );

    const helper =
      block(
        jobs,
        'private consumeActiveGenerationCancellation',
        'async onModuleInit'
      );

    assert.match(
      helper,
      /activeGenerationCancellations\.has\s*\(\s*jobId\s*\)/
    );

    assert.match(
      helper,
      /activeGenerationCancellations\.delete\s*\(\s*jobId\s*\)/
    );

    assert.match(
      helper,
      /return true/
    );
  }
);

test(
  'processing generation cancellation registers intent and stops its provider before Mongo cancellation',
  () => {
    const cancel =
      block(
        jobs,
        'async cancel(',
        'async remove('
      );

    assert.doesNotMatch(
      cancel,
      /Active generation cancellation is not implemented yet\./
    );

    assert.match(
      cancel,
      /job\.status\s*===\s*['"]processing['"]/
    );

    assert.match(
      cancel,
      /job\.jobType\s*!==\s*['"]generate['"]/
    );

    assert.match(
      cancel,
      /MUSIC_MODELS\.find/
    );

    assert.match(
      cancel,
      /activeGenerationCancellations\.add\s*\(\s*id\s*\)/
    );

    assert.match(
      cancel,
      /await this\.musicRuntime\.cancelGeneration\s*\(\s*model\.providerId\s*\)/
    );

    const intent =
      cancel.indexOf(
        'activeGenerationCancellations.add'
      );

    const stop =
      cancel.indexOf(
        'musicRuntime.cancelGeneration'
      );

    const mongoCancelled =
      cancel.search(
        /job\.status\s*=\s*['"]cancelled['"]/
      );

    assert.ok(
      intent >= 0,
      'cancellation intent must be registered'
    );

    assert.ok(
      stop >= 0,
      'provider cancellation must occur'
    );

    assert.ok(
      mongoCancelled >= 0,
      'Mongo cancellation must remain'
    );

    assert.ok(
      intent < stop,
      'intent must be visible before provider termination starts'
    );

    assert.ok(
      stop < mongoCancelled,
      'provider termination must complete before Mongo becomes cancelled'
    );
  }
);

test(
  'failed provider termination clears cancellation intent instead of lying about cancellation',
  () => {
    const cancel =
      block(
        jobs,
        'async cancel(',
        'async remove('
      );

    assert.match(
      cancel,
      /catch\s*\([^)]*\)\s*\{[\s\S]*activeGenerationCancellations\.delete\s*\(\s*id\s*\)[\s\S]*throw/s
    );

    const stop =
      cancel.indexOf(
        'musicRuntime.cancelGeneration'
      );

    const mongoCancelled =
      cancel.search(
        /job\.status\s*=\s*['"]cancelled['"]/
      );

    assert.ok(
      stop >= 0 &&
      mongoCancelled > stop,
      'Mongo must not be marked cancelled before provider termination succeeds'
    );
  }
);

test(
  'generation redelivery ignores every terminal Mongo state',
  () => {
    const process =
      block(
        jobs,
        'async processGenerationJob(',
        'private validateGenerationRequest'
      );

    assert.match(
      process,
      /\[['"]completed['"],\s*['"]failed['"],\s*['"]cancelled['"]\]\.includes\s*\(\s*job\.status\s*\)/
    );

    const terminalGuard =
      process.search(
        /\[['"]completed['"],\s*['"]failed['"],\s*['"]cancelled['"]\]\.includes/
      );

    const selectModel =
      process.indexOf(
        'musicRuntime.selectModel'
      );

    assert.ok(
      terminalGuard >= 0
    );

    assert.ok(
      selectModel > terminalGuard,
      'terminal redelivery guard must run before provider work'
    );
  }
);

test(
  'active cancellation is consumed before validation or completion',
  () => {
    const process =
      block(
        jobs,
        'async processGenerationJob(',
        'private validateGenerationRequest'
      );

    assert.match(
      process,
      /consumeActiveGenerationCancellation\s*\(\s*jobId\s*\)/
    );

    const cancellationCheck =
      process.indexOf(
        'consumeActiveGenerationCancellation(jobId)'
      );

    const validate =
      process.indexOf(
        'this.validateWav'
      );

    const complete =
      process.indexOf(
        'this.complete'
      );

    assert.ok(
      cancellationCheck >= 0,
      'post-provider cancellation check must exist'
    );

    assert.ok(
      validate > cancellationCheck,
      'cancellation must be consumed before WAV validation'
    );

    assert.ok(
      complete > cancellationCheck,
      'cancellation must be consumed before completion'
    );
  }
);

test(
  'provider termination errors caused by cancellation do not become failed jobs',
  () => {
    const process =
      block(
        jobs,
        'async processGenerationJob(',
        'private validateGenerationRequest'
      );

    const catchIndex =
      process.lastIndexOf(
        'catch (error)'
      );

    assert.ok(
      catchIndex >= 0,
      'generation catch block must exist'
    );

    const catchBlock =
      process.slice(
        catchIndex
      );

    assert.match(
      catchBlock,
      /consumeActiveGenerationCancellation\s*\(\s*jobId\s*\)/
    );

    const cancellationCheck =
      catchBlock.indexOf(
        'consumeActiveGenerationCancellation(jobId)'
      );

    const fail =
      catchBlock.indexOf(
        'this.fail'
      );

    assert.ok(
      cancellationCheck >= 0
    );

    assert.ok(
      fail > cancellationCheck,
      'cancellation must suppress normal failure persistence'
    );
  }
);
