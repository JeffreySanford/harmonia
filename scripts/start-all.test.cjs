const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  existsSync,
  readFileSync,
} = require('node:fs');
const path = require('node:path');

const script = path.join(__dirname, 'start-all.cjs');
test('startup orchestrator exists', () => assert.ok(existsSync(script)));

test('startup seeds generated demo songs after database readiness', () => {
  const source =
    readFileSync(
      script,
      'utf8'
    );

  const importPosition =
    source.indexOf(
      "require('./seed-generated-songs.cjs')"
    );

  const databasePingPosition =
    source.indexOf(
      'await connection.db.admin().ping()'
    );

  const seedPosition =
    source.indexOf(
      'await seedGeneratedSongs({'
    );

  const ollamaPosition =
    source.indexOf(
      'await checkOllama(env)'
    );

  assert.ok(
    importPosition >= 0,
    'generated-song seeder must be imported'
  );

  assert.ok(
    databasePingPosition >= 0,
    'database readiness probe must exist'
  );

  assert.ok(
    seedPosition > databasePingPosition,
    'demo seed must happen after database readiness'
  );

  assert.ok(
    ollamaPosition > seedPosition,
    'demo seed must happen before optional Ollama validation'
  );

  assert.match(
    source,
    /mongoUri:\s*env\.MONGODB_URI/
  );
});

test('resolves Nx CLI from package metadata', () => {
  const { resolvePackageBin } = require(script);
  const nx = resolvePackageBin('nx', 'nx');

  assert.equal(existsSync(nx), true);
  assert.equal(path.basename(nx), 'nx.js');
  assert.match(nx, /[\\/]dist[\\/]bin[\\/]nx\.js$/);
});

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
  const upCalls = calls.filter((args) => args.includes('up'));
  assert.equal(upCalls.length, 2);

  const reconcileUp = upCalls[0];
  assert.ok(reconcileUp.includes('--no-build'));
  assert.ok(!reconcileUp.includes('--wait'));

  const readinessUp = upCalls[1];
  for (const flag of ['--no-build', '--wait', '--wait-timeout']) {
    assert.ok(readinessUp.includes(flag));
  }
  assert.ok(
    calls.some(
      (args) => args.includes('build') && args.includes('--provenance=false')
    )
  );
  assert.ok(!readinessUp.includes('--force-recreate'));
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
    JWT_SECRET:
      'access-test-secret-012345678901234567890',
    JWT_REFRESH_SECRET:
      'refresh-test-secret-01234567890123456789',
  });
  assert.equal(
    env.MONGODB_URI,
    'mongodb://harmonia_app:p%40ss%3A%2F%20word@127.0.0.1:27017/harmonia?authSource=harmonia'
  );
  assert.equal(env.PORT, '3000');
});

test('requires strong independent JWT secrets', () => {
  const {
    applicationEnvironment,
  } = require(script);

  const base = {
    MONGO_ROOT_PASSWORD:
      'root-test',
    MONGO_HARMONIA_PASSWORD:
      'app-test',
  };

  assert.throws(
    () =>
      applicationEnvironment({
        ...base,
        JWT_SECRET:
          'access-test-secret-012345678901234567890',
      }),
    /JWT_REFRESH_SECRET/
  );

  assert.throws(
    () =>
      applicationEnvironment({
        ...base,
        JWT_SECRET:
          'short',
        JWT_REFRESH_SECRET:
          'refresh-test-secret-01234567890123456789',
      }),
    /JWT_SECRET.*32/
  );

  const shared =
    'shared-test-secret-012345678901234567890';

  assert.throws(
    () =>
      applicationEnvironment({
        ...base,
        JWT_SECRET:
          shared,
        JWT_REFRESH_SECRET:
          shared,
      }),
    /must be different/
  );
});

test('rejects a backend port that the frontend cannot reach', () => {
  const { applicationEnvironment } = require(script);
  assert.throws(
    () =>
      applicationEnvironment({
        MONGO_ROOT_PASSWORD: 'root-test',
        MONGO_HARMONIA_PASSWORD: 'app-test',
        JWT_SECRET:
      'access-test-secret-012345678901234567890',
    JWT_REFRESH_SECRET:
      'refresh-test-secret-01234567890123456789',
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
    JWT_SECRET:
      'access-test-secret-012345678901234567890',
    JWT_REFRESH_SECRET:
      'refresh-test-secret-01234567890123456789',
    MONGODB_URI: 'mongodb://other/db',
    PORT: '3000',
  };
  assert.equal(applicationEnvironment(env).MONGODB_URI, env.MONGODB_URI);
});

test('startup GPU mode defaults to auto detection and supports overrides', () => {
  const {
    parseOptions,
  } = require(script);

  assert.equal(
    parseOptions([]).gpuMode,
    'auto'
  );

  assert.equal(
    parseOptions(['--gpu']).gpuMode,
    'required'
  );

  assert.equal(
    parseOptions(['--nogpu']).gpuMode,
    'disabled'
  );

  assert.throws(
    () =>
      parseOptions([
        '--gpu',
        '--nogpu',
      ]),
    /cannot be used together/
  );

  assert.throws(
    () => parseOptions(['--wat']),
    /Unknown option/
  );
});

test('host GPU detection discovers NVIDIA device data dynamically', () => {
  const {
    detectHostGpu,
  } = require(script);

  const detected =
    detectHostGpu(
      (command, args) => {
        assert.equal(
          command,
          'nvidia-smi'
        );

        assert.deepEqual(
          args,
          [
            '--query-gpu=name,memory.total',
            '--format=csv,noheader,nounits',
          ]
        );

        return {
          status: 0,
          stdout:
            'Mock NVIDIA Adapter, 16384',
        };
      },
      'linux'
    );

  assert.deepEqual(
    detected,
    {
      available: true,
      vendor: 'nvidia',
      name: 'Mock NVIDIA Adapter',
      memoryMb: 16384,
    }
  );
});

test('host GPU detection discovers AMD device data dynamically on Windows', () => {
  const {
    detectHostGpu,
  } = require(script);

  const detected =
    detectHostGpu(
      (command) => {
        if (command === 'nvidia-smi') {
          return {
            status: 1,
            stdout: '',
          };
        }

        if (
          command ===
          'powershell.exe'
        ) {
          return {
            status: 0,
            stdout:
              JSON.stringify({
                Name:
                  'Mock AMD Adapter',
                AdapterRAM:
                  8 * 1024 * 1024 * 1024,
              }),
          };
        }

        return {
          status: 1,
          stdout: '',
        };
      },
      'win32'
    );

  assert.equal(
    detected.available,
    true
  );

  assert.equal(
    detected.vendor,
    'amd'
  );

  assert.equal(
    detected.name,
    'Mock AMD Adapter'
  );
});

test('host GPU detection returns an empty profile when no supported vendor is found', () => {
  const {
    detectHostGpu,
  } = require(script);

  const detected =
    detectHostGpu(
      () => ({
        status: 1,
        stdout: '',
      }),
      'linux'
    );

  assert.deepEqual(
    detected,
    {
      available: false,
      vendor: null,
      name: null,
      memoryMb: null,
    }
  );
});

test('GPU mode auto-enables the compatible runtime and --nogpu always wins', () => {
  const {
    parseOptions,
    resolveGpuEnabled,
  } = require(script);

  const compatibleGpu = {
    available: true,
    vendor: 'nvidia',
    name: 'Mock Compatible GPU',
    memoryMb: null,
  };

  const detectedButUnsupportedGpu = {
    available: true,
    vendor: 'amd',
    name: 'Mock Alternate GPU',
    memoryMb: null,
  };

  const noGpu = {
    available: false,
    vendor: null,
    name: null,
    memoryMb: null,
  };

  assert.equal(
    resolveGpuEnabled(
      parseOptions([]),
      compatibleGpu
    ),
    true
  );

  assert.equal(
    resolveGpuEnabled(
      parseOptions([]),
      detectedButUnsupportedGpu
    ),
    false
  );

  assert.equal(
    resolveGpuEnabled(
      parseOptions([]),
      noGpu
    ),
    false
  );

  assert.equal(
    resolveGpuEnabled(
      parseOptions(['--nogpu']),
      compatibleGpu
    ),
    false
  );

  assert.equal(
    resolveGpuEnabled(
      parseOptions(['--gpu']),
      compatibleGpu
    ),
    true
  );

  assert.throws(
    () =>
      resolveGpuEnabled(
        parseOptions(['--gpu']),
        detectedButUnsupportedGpu
      ),
    /does not support that vendor/
  );

  assert.throws(
    () =>
      resolveGpuEnabled(
        parseOptions(['--gpu']),
        noGpu
      ),
    /no supported host GPU/
  );
});

test('canonical Compose arguments use only the resolved GPU decision', () => {
  const {
    composeArguments,
    parseOptions,
  } = require(script);

  assert.deepEqual(
    composeArguments({
      ...parseOptions([]),
      gpu: false,
    }),
    [
      'compose',
      '-f',
      'docker-compose.yml',
      '--profile',
      'worker',
      '--profile',
      'tools',
    ]
  );

  assert.deepEqual(
    composeArguments({
      ...parseOptions([]),
      gpu: true,
      tools: false,
    }),
    [
      'compose',
      '-f',
      'docker-compose.yml',
      '-f',
      'docker-compose.gpu.yml',
      '--profile',
      'worker',
    ]
  );

  assert.deepEqual(
    composeArguments({
      ...parseOptions(['--nogpu']),
      gpu: false,
      worker: false,
    }),
    [
      'compose',
      '-f',
      'docker-compose.yml',
      '--profile',
      'tools',
    ]
  );
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(
      checkPort(server.address().port, 'Frontend', '127.0.0.1'),
      /Frontend port .* unavailable/
    );
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('detects an app listener bound only to IPv6 localhost', async (t) => {
  const { checkPort } = require(script);
  const server = require('node:net').createServer();

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '::1', resolve);
    });
  } catch (error) {
    if (error?.code === 'EADDRNOTAVAIL') {
      t.skip('IPv6 loopback is unavailable in this environment');
      return;
    }
    throw error;
  }

  try {
    await assert.rejects(
      checkPort(server.address().port, 'Frontend'),
      /Frontend port .* unavailable on ::1/
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('managed Docker port preflight allows Harmonia owner and rejects conflicts', async () => {
  const { checkManagedDockerPort } = require(script);
  const probedHosts = [];
  const unavailable = async (_port, _name, host) => {
    probedHosts.push(host);
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
  assert.equal(probedHosts[0], '127.0.0.1');

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
    async (_port, _name, host) => {
      assert.equal(host, '127.0.0.1');
    }
  );
  assert.equal(calledForFreePort, false);
});
