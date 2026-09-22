const assert = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync } = require('node:fs');
const path = require('node:path');

const script = path.join(__dirname, 'start-all.cjs');
test('startup orchestrator exists', () => assert.ok(existsSync(script)));

test('reconciles all services without forcing healthy containers to restart', () => {
  const { reconcileDocker } = require(script);
  const calls = [];
  const run = (args) => {
    calls.push(args);
    if (args.includes('ps')) return 'healthy\nsick\nstopped\n';
    if (args[0] === 'inspect') {
      const id = args.at(-1);
      return JSON.stringify({
        Running: id !== 'stopped',
        Health: { Status: id === 'sick' ? 'unhealthy' : 'healthy' },
      });
    }
    return '';
  };
  reconcileDocker(run, ['compose', '-f', 'test.yml']);
  assert.deepEqual(
    calls.filter((args) => args[0] === 'restart'),
    [['restart', 'sick']]
  );
  const up = calls.find((args) => args.includes('up'));
  for (const flag of ['--no-build', '--wait', '--wait-timeout']) {
    assert.ok(up.includes(flag));
  }
  assert.ok(
    calls.some(
      (args) => args.includes('build') && args.includes('--provenance=false')
    )
  );
  assert.ok(!up.includes('--force-recreate'));
});

test('can reconcile image-only services without invoking a build', () => {
  const { reconcileDocker } = require(script);
  const calls = [];
  const run = (args) => {
    calls.push(args);
    if (args.includes('ps')) return '';
    return '';
  };
  reconcileDocker(run, ['compose'], { build: false });
  assert.equal(calls.some((args) => args.includes('build')), false);
  assert.ok(calls.some((args) => args.includes('up')));
});

test('Docker failure prevents successful reconciliation', () => {
  const { reconcileDocker } = require(script);
  assert.throws(
    () =>
      reconcileDocker(() => {
        throw new Error('Docker unavailable');
      }, ['compose']),
    /Docker unavailable/
  );
});

test('database credentials are required and encoded for the application URI', () => {
  const { applicationEnvironment } = require(script);
  assert.throws(() => applicationEnvironment({}), /MONGO_ROOT_PASSWORD/);
  const env = applicationEnvironment({
    MONGO_ROOT_PASSWORD: 'root-test',
    MONGO_HARMONIA_PASSWORD: 'p@ss:/ word',
    JWT_SECRET: 'test-secret',
  });
  assert.equal(
    env.MONGODB_URI,
    'mongodb://harmonia_app:p%40ss%3A%2F%20word@127.0.0.1:27017/harmonia?authSource=harmonia'
  );
  assert.equal(env.PORT, '3000');
});

test('rejects a backend port that the frontend cannot reach', () => {
  const { applicationEnvironment } = require(script);
  assert.throws(
    () =>
      applicationEnvironment({
        MONGO_ROOT_PASSWORD: 'root-test',
        MONGO_HARMONIA_PASSWORD: 'app-test',
        JWT_SECRET: 'test-secret',
        PORT: '3100',
      }),
    /PORT=3000/
  );
});

test('explicit application database settings are preserved', () => {
  const { applicationEnvironment } = require(script);
  const env = {
    MONGO_ROOT_PASSWORD: 'root-test',
    MONGO_HARMONIA_PASSWORD: 'app-test',
    JWT_SECRET: 'test-secret',
    MONGODB_URI: 'mongodb://other/db',
    PORT: '3000',
  };
  assert.equal(applicationEnvironment(env).MONGODB_URI, env.MONGODB_URI);
});

test('startup options select canonical profiles and optional GPU override', () => {
  const { composeArguments, parseOptions } = require(script);
  assert.deepEqual(composeArguments(parseOptions([])), [
    'compose',
    '-f',
    'docker-compose.yml',
    '--profile',
    'worker',
    '--profile',
    'tools',
  ]);
  assert.deepEqual(composeArguments(parseOptions(['--gpu', '--no-tools'])), [
    'compose',
    '-f',
    'docker-compose.yml',
    '-f',
    'docker-compose.gpu.yml',
    '--profile',
    'worker',
  ]);
  assert.deepEqual(composeArguments(parseOptions(['--no-worker'])), [
    'compose',
    '-f',
    'docker-compose.yml',
    '--profile',
    'tools',
  ]);
  assert.throws(
    () => parseOptions(['--gpu', '--no-worker']),
    /cannot be combined/
  );
  assert.throws(() => parseOptions(['--wat']), /Unknown option/);
});

test('Ollama is checked only when enabled', async () => {
  const { checkOllama } = require(script);
  let called = false;
  await checkOllama({ USE_OLLAMA: 'false' }, async () => {
    called = true;
    return { ok: true };
  });
  assert.equal(called, false);

  await checkOllama(
    { USE_OLLAMA: 'true', OLLAMA_URL: 'http://localhost:11434' },
    async (url) => {
      called = true;
      assert.equal(url.toString(), 'http://localhost:11434/api/tags');
      return { ok: true, status: 200 };
    }
  );
  assert.equal(called, true);

  await assert.rejects(
    checkOllama(
      { USE_OLLAMA: 'true', OLLAMA_URL: 'http://localhost:11434' },
      async () => ({ ok: false, status: 503 })
    ),
    /Ollama is not reachable/
  );
});

test('occupied app ports fail without stopping the existing server', async () => {
  const { checkPort } = require(script);
  const server = require('node:net').createServer();
  await new Promise((resolve) => server.listen(0, '0.0.0', resolve));
  try {
    await assert.rejects(
      checkPort(server.address().port, 'Frontend'),
      /Frontend port .* unavailable/
    );
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('managed Docker port preflight allows Harmonia owner and rejects conflicts', async () => {
  const { checkManagedDockerPort } = require(script);
  const unavailable = async () => {
    throw new Error('occupied');
  };

  const dockerCalls = [];
  await checkManagedDockerPort(
    27017,
    'MongoDB',
    'harmonia-mongo-i9',
    (args, capture) => {
      dockerCalls.push({ args, capture });
      return 'harmonia-mongo-i9\n';
    },
    unavailable
  );
  assert.deepEqual(dockerCalls, [
    {
      args: ['ps', '--filter', 'publish=27017', '--format', '{{.Names}}'],
      capture: true,
    },
  ]);

  await assert.rejects(
    checkManagedDockerPort(
      27017,
      'MongoDB',
      'harmonia-mongo-i9',
      () => 'other-mongo\n',
      unavailable
    ),
    /other-mongo/
  );

  await assert.rejects(
    checkManagedDockerPort(
      27017,
      'MongoDB',
      'harmonia-mongo-i9',
      () => '',
      unavailable
    ),
    /host process or service/
  );

  let calledForFreePort = false;
  await checkManagedDockerPort(
    27017,
    'MongoDB',
    'harmonia-mongo-i9',
    () => {
      calledForFreePort = true;
      return '';
    },
    async () => {}
  );
  assert.equal(calledForFreePort, false);
});
