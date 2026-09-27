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

const pkg = JSON.parse(read('package.json'));

const appModule = read(
  'apps/backend/src/app/app.module.ts'
);

const jobsModule = read(
  'apps/backend/src/jobs/jobs.module.ts'
);

const compose = read('docker-compose.yml');

const composeValidator = read(
  'scripts/validate-compose.cjs'
);

function composeServiceBlock(name) {
  const marker = new RegExp(
    '^  ' + name + ':\\s*$',
    'm'
  );

  const match = marker.exec(compose);

  if (!match) {
    return '';
  }

  const start = match.index;
  const remainder = compose.slice(
    start + match[0].length
  );

  const nextService =
    /\n  [A-Za-z0-9_.-]+:\s*(?:\n|$)/m.exec(
      remainder
    );

  const end =
    nextService === null
      ? compose.length
      : start +
        match[0].length +
        nextService.index;

  return compose.slice(start, end);
}

test(
  'Bull queue dependencies remain production dependencies',
  () => {
    assert.ok(
      pkg.dependencies['@nestjs/bull'],
      '@nestjs/bull must be a production dependency'
    );

    assert.ok(
      pkg.dependencies.bull,
      'bull must be a production dependency'
    );
  }
);

test(
  'durable queue contract is wired into startup and script lint gates',
  () => {
    assert.equal(
      pkg.scripts['test:durable-queue'],
      'node --test scripts/durable-generation-queue-contract.test.cjs'
    );

    assert.match(
      pkg.scripts['test:startup'],
      /scripts\/durable-generation-queue-contract\.test\.cjs/
    );

    assert.match(
      pkg.scripts['lint:scripts'],
      /node --check scripts\/durable-generation-queue-contract\.test\.cjs/
    );
  }
);

test(
  'backend configures Bull against the local Redis service',
  () => {
    assert.match(
      appModule,
      /from ['"]@nestjs\/bull['"]/
    );

    assert.match(
      appModule,
      /BullModule\.forRootAsync\s*\(/
    );

    assert.match(
      appModule,
      /REDIS_HOST/
    );

    assert.match(
      appModule,
      /REDIS_PORT/
    );

    assert.match(
      appModule,
      /127\.0\.0\.1/
    );

    assert.match(
      appModule,
      /6379/
    );
  }
);

test(
  'JobsModule registers one dedicated generation queue',
  () => {
    assert.match(
      jobsModule,
      /from ['"]@nestjs\/bull['"]/
    );

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
  'Compose provides persistent loopback-only Redis with AOF',
  () => {
    const redis = composeServiceBlock('redis');

    assert.notEqual(
      redis,
      '',
      'docker-compose.yml must define redis'
    );

    assert.match(
      redis,
      /image:\s*redis:7(?:\.[0-9]+)?-alpine/
    );

    assert.match(
      redis,
      /127\.0\.0\.1:6379:6379/
    );

    assert.match(
      redis,
      /healthcheck:/
    );

    assert.match(
      redis,
      /redis-cli/
    );

    assert.match(
      redis,
      /--appendonly/
    );

    assert.match(
      redis,
      /redis-data/
    );

    assert.match(
      compose,
      /^  redis-data:\s*$/m
    );
  }
);

test(
  'Compose validation treats Redis 6379 as part of the platform contract',
  () => {
    assert.match(
      composeValidator,
      /['"]redis['"]/
    );

    assert.match(
      composeValidator,
      /6379/
    );
  }
);
