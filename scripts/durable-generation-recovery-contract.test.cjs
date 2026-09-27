const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    'utf8'
  );
}

const jobsService = read(
  'apps/backend/src/jobs/jobs.service.ts'
);

test(
  'durable generation dispatch remains the execution foundation',
  () => {
    assert.match(
      jobsService,
      /@InjectQueue\(\s*['"]generation['"]\s*\)/
    );

    assert.match(
      jobsService,
      /generationQueue/
    );

    assert.doesNotMatch(
      jobsService,
      /generationTail/
    );
  }
);

test(
  'JobsService reconciles generation work during module startup',
  () => {
    assert.match(
      jobsService,
      /OnModuleInit/
    );

    assert.match(
      jobsService,
      /implements\s+OnModuleInit/
    );

    assert.match(
      jobsService,
      /async\s+onModuleInit\s*\(\s*\)/
    );

    assert.match(
      jobsService,
      /await\s+this\.generationQueue\.isReady\s*\(\s*\)/
    );

    assert.match(
      jobsService,
      /await\s+this\.reconcileGenerationQueue\s*\(\s*\)/
    );
  }
);

test(
  'startup recovery scans only nonterminal generation records',
  () => {
    assert.match(
      jobsService,
      /reconcileGenerationQueue/
    );

    assert.match(
      jobsService,
      /jobType:\s*['"]generate['"]/
    );

    assert.match(
      jobsService,
      /status:\s*\{\s*\$in:\s*\[[\s\S]*['"]queued['"][\s\S]*['"]processing['"][\s\S]*\]/
    );

    assert.match(
      jobsService,
      /\.exec\s*\(\s*\)/
    );
  }
);

test(
  'existing Bull jobs suppress duplicate startup enqueue',
  () => {
    assert.match(
      jobsService,
      /generationQueue\.getJob\s*\(/
    );

    assert.match(
      jobsService,
      /if\s*\(\s*(?:existing|queueJob|bullJob)\s*\)\s*\{[\s\S]*continue\s*;[\s\S]*\}/
    );
  }
);

test(
  'orphaned Mongo generation records are durably re-enqueued',
  () => {
    assert.match(
      jobsService,
      /generationQueue\.add\s*\(/
    );

    assert.match(
      jobsService,
      /['"]generate['"]/
    );

    assert.match(
      jobsService,
      /jobId/
    );

    assert.match(
      jobsService,
      /userId/
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
  'orphaned processing records return to queued state before replay',
  () => {
    assert.match(
      jobsService,
      /status\s*===\s*['"]processing['"]/
    );

    assert.match(
      jobsService,
      /status\s*=\s*['"]queued['"]/
    );

    assert.match(
      jobsService,
      /startedAt\s*=\s*null/
    );

    assert.match(
      jobsService,
      /Recovered[\s\S]*restart|restart[\s\S]*Recovered/i
    );

    assert.match(
      jobsService,
      /await\s+\w+\.save\s*\(\s*\)/
    );
  }
);
