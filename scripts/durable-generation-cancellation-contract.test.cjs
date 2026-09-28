const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const servicePath =
  path.join(
    root,
    'apps',
    'backend',
    'src',
    'jobs',
    'jobs.service.ts'
  );

const service =
  fs.readFileSync(
    servicePath,
    'utf8'
  );

function methodBlock(
  startNeedle,
  endNeedle
) {
  const start =
    service.indexOf(
      startNeedle
    );

  assert.ok(
    start >= 0,
    `${startNeedle} must exist`
  );

  const end =
    service.indexOf(
      endNeedle,
      start + startNeedle.length
    );

  assert.ok(
    end > start,
    `${endNeedle} must follow ${startNeedle}`
  );

  return service.slice(
    start,
    end
  );
}

test(
  'durable generation queue remains the cancellation foundation',
  () => {
    assert.match(
      service,
      /@InjectQueue\(['"]generation['"]\)/
    );

    assert.match(
      service,
      /private readonly generationQueue:\s*Queue/
    );

    assert.match(
      service,
      /jobId:\s*result\.id/
    );
  }
);

test(
  'queued generation cancellation resolves its Bull job by Mongo identity',
  () => {
    const cancel =
      methodBlock(
        'async cancel(',
        'async remove('
      );

    assert.match(
      cancel,
      /job\.jobType\s*===\s*['"]generate['"]/
    );

    assert.match(
      cancel,
      /job\.status\s*===\s*['"]queued['"]/
    );

    assert.match(
      cancel,
      /generationQueue\.getJob\s*\(\s*id\s*\)/
    );
  }
);

test(
  'queued Bull work is removed before Mongo is marked cancelled',
  () => {
    const cancel =
      methodBlock(
        'async cancel(',
        'async remove('
      );

    assert.match(
      cancel,
      /await\s+\w+\.remove\s*\(\s*\)/
    );

    const getBull =
      cancel.indexOf(
        'generationQueue.getJob'
      );

    const removeBull =
      cancel.search(
        /await\s+\w+\.remove\s*\(\s*\)/
      );

    const cancelMongo =
      cancel.search(
        /job\.status\s*=\s*['"]cancelled['"]/
      );

    assert.ok(
      getBull >= 0,
      'Bull lookup must exist'
    );

    assert.ok(
      removeBull >= 0,
      'Bull removal must exist'
    );

    assert.ok(
      cancelMongo >= 0,
      'Mongo cancellation must remain'
    );

    assert.ok(
      getBull < removeBull,
      'Bull lookup must precede Bull removal'
    );

    assert.ok(
      removeBull < cancelMongo,
      'Bull removal must happen before Mongo is marked cancelled'
    );
  }
);

test(
  'missing Bull work does not prevent queued Mongo cancellation',
  () => {
    const cancel =
      methodBlock(
        'async cancel(',
        'async remove('
      );

    assert.match(
      cancel,
      /if\s*\(\s*\w+\s*\)\s*\{[\s\S]*?await\s+\w+\.remove\s*\(\s*\)/s
    );

    const cancelMongo =
      cancel.search(
        /job\.status\s*=\s*['"]cancelled['"]/
      );

    assert.ok(
      cancelMongo >= 0,
      'Mongo cancellation must remain outside the optional Bull removal branch'
    );
  }
);

test(
  'processing generation cancellation remains isolated from queued Bull removal',
  () => {
    const cancel =
      methodBlock(
        'async cancel(',
        'async remove('
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
      /activeGenerationCancellations\.add\s*\(\s*id\s*\)/
    );

    assert.match(
      cancel,
      /musicRuntime\.cancelGeneration/
    );

    assert.doesNotMatch(
      cancel,
      /Active generation cancellation is not implemented yet\./
    );

    const processingGuard =
      cancel.search(
        /job\.status\s*===\s*['"]processing['"]/
      );

    const activeCancel =
      cancel.search(
        /musicRuntime\.cancelGeneration/
      );

    const queuedGuard =
      cancel.search(
        /job\.jobType\s*===\s*['"]generate['"]\s*&&\s*job\.status\s*===\s*['"]queued['"]/
      );

    const bullLookup =
      cancel.search(
        /generationQueue\.getJob/
      );

    const mongoCancelled =
      cancel.search(
        /job\.status\s*=\s*['"]cancelled['"]/
      );

    assert.ok(
      processingGuard >= 0,
      'processing generation branch must remain explicit'
    );

    assert.ok(
      activeCancel > processingGuard,
      'active provider cancellation must remain in the processing path'
    );

    assert.ok(
      queuedGuard > activeCancel,
      'queued durable cancellation must remain a separate later branch'
    );

    assert.ok(
      bullLookup > queuedGuard,
      'Bull lookup must remain confined to queued generation cancellation'
    );

    assert.ok(
      mongoCancelled > activeCancel,
      'provider termination must precede Mongo cancellation'
    );
  }
);

test(
  'terminal jobs remain protected from cancellation',
  () => {
    const cancel =
      methodBlock(
        'async cancel(',
        'async remove('
      );

    assert.match(
      cancel,
      /\[['"]completed['"],\s*['"]failed['"],\s*['"]cancelled['"]\]\.includes\(job\.status\)/
    );

    assert.match(
      cancel,
      /cannot be cancelled/
    );
  }
);
