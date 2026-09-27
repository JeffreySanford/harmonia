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

function readOptional(relativePath) {
  const absolute = path.join(
    root,
    relativePath
  );

  return fs.existsSync(absolute)
    ? fs.readFileSync(absolute, 'utf8')
    : '';
}

const jobsService = read(
  'apps/backend/src/jobs/jobs.service.ts'
);

const jobsModule = read(
  'apps/backend/src/jobs/jobs.module.ts'
);

const processor = readOptional(
  'apps/backend/src/jobs/generation.processor.ts'
);

test(
  'generation queue foundation remains registered',
  () => {
    assert.match(
      jobsModule,
      /BullModule\.registerQueue\s*\(/
    );

    assert.match(
      jobsModule,
      /name:\s*['"]generation['"]/
    );
  }
);

test(
  'JobsService injects the generation Bull queue',
  () => {
    assert.match(
      jobsService,
      /from ['"]@nestjs\/bull['"]/
    );

    assert.match(
      jobsService,
      /from ['"]bull['"]/
    );

    assert.match(
      jobsService,
      /@InjectQueue\(\s*['"]generation['"]\s*\)/
    );

    assert.match(
      jobsService,
      /generationQueue/
    );
  }
);

test(
  'generation creation durably enqueues the Mongo job identity',
  () => {
    assert.match(
      jobsService,
      /await\s+this\.generationQueue\.add\s*\(/
    );

    assert.match(
      jobsService,
      /['"]generate['"]/
    );

    assert.match(
      jobsService,
      /jobId:\s*result\.id/
    );

    assert.match(
      jobsService,
      /userId/
    );

    assert.match(
      jobsService,
      /\{\s*jobId:\s*result\.id[\s\S]*userId[\s\S]*\}/
    );
  }
);

test(
  'process-local promise-chain scheduling is removed',
  () => {
    assert.doesNotMatch(
      jobsService,
      /generationTail/
    );

    assert.doesNotMatch(
      jobsService,
      /setTimeout\s*\(\s*\(\)\s*=>\s*this\.enqueueGeneration/
    );

    assert.doesNotMatch(
      jobsService,
      /private\s+enqueueGeneration\s*\(/
    );

    assert.doesNotMatch(
      jobsService,
      /private\s+async\s+processGenerationJob\s*\(/
    );

    assert.match(
      jobsService,
      /async\s+processGenerationJob\s*\(/
    );
  }
);

test(
  'one GenerationProcessor handles generate jobs at concurrency one',
  () => {
    assert.notEqual(
      processor,
      '',
      'generation.processor.ts must exist'
    );

    assert.match(
      processor,
      /from ['"]@nestjs\/bull['"]/
    );

    assert.match(
      processor,
      /from ['"]bull['"]/
    );

    assert.match(
      processor,
      /@Processor\(\s*['"]generation['"]\s*\)/
    );

    assert.match(
      processor,
      /@Process\(\s*\{[\s\S]*name:\s*['"]generate['"][\s\S]*concurrency:\s*1[\s\S]*\}\s*\)/
    );

    assert.match(
      processor,
      /Job\s*</
    );

    assert.match(
      processor,
      /job\.data\.jobId/
    );

    assert.match(
      processor,
      /job\.data\.userId/
    );

    assert.match(
      processor,
      /this\.jobsService\.processGenerationJob\s*\(/
    );
  }
);

test(
  'JobsModule registers exactly one generation processor provider',
  () => {
    assert.match(
      jobsModule,
      /GenerationProcessor/
    );

    assert.match(
      jobsModule,
      /from ['"]\.\/generation\.processor['"]/
    );

    assert.match(
      jobsModule,
      /providers:\s*\[[^\]]*GenerationProcessor[^\]]*\]/
    );
  }
);
