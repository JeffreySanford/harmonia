#!/usr/bin/env node
// Compose owns config/image change detection; do not force-recreate healthy services.
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');

function run(command, args, env, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.signal || result.status}). See output above.`);
  return result.stdout || '';
}

function applicationEnvironment(env) {
  for (const key of ['MONGO_ROOT_PASSWORD', 'MONGO_HARMONIA_PASSWORD', 'JWT_SECRET']) {
    if (!env[key]?.trim()) throw new Error(`Set ${key} in .env before starting. See .env.example.`);
  }
  if (env.PORT && env.PORT !== '3000') {
    throw new Error('start:all requires PORT=3000 to match the frontend API configuration.');
  }
  return {
    ...env,
    PORT: env.PORT || '3000',
    MONGODB_URI:
      env.MONGODB_URI ||
      `mongodb://harmonia_app:${encodeURIComponent(env.MONGO_HARMONIA_PASSWORD)}@127.0.0.1:27017/harmonia?authSource=harmonia`,
  };
}

function parseOptions(args) {
  if (args.includes('--help')) return { help: true, worker: true, tools: true, gpu: false };
  const known = new Set(['--no-worker', '--no-tools', '--gpu']);
  const unknown = args.find((arg) => !known.has(arg));
  if (unknown) throw new Error(`Unknown option: ${unknown}. Use --help for usage.`);
  const options = {
    help: false,
    worker: !args.includes('--no-worker'),
    tools: !args.includes('--no-tools'),
    gpu: args.includes('--gpu'),
  };
    return options;
}

function composeArguments(options) {
  const compose = ['compose', '-f', 'docker-compose.yml'];
  if (options.gpu) compose.push('-f', 'docker-compose.gpu.yml');
  if (options.worker) compose.push('--profile', 'worker');
  if (options.tools) compose.push('--profile', 'tools');
  return compose;
}

function reconcileDocker(docker, compose, { build = true } = {}) {
  if (build) {
    // BuildKit provenance contains timestamps, which can change an otherwise cached
    // image's digest. Local dev builds omit it so clean containers keep their IDs.
    docker([...compose, 'build', '--provenance=false']);
  }

  // Let Compose reconcile image/config changes before attempting health recovery.
  // This is important when an existing container is unhealthy AND its image was
  // just rebuilt: restarting the stale container first would keep it on the old image.
  docker([
    ...compose,
    'up',
    '--detach',
    '--no-build',
  ]);

  // Recover only containers that are still unhealthy after Compose has had the
  // opportunity to recreate changed services.
  const ids = docker([...compose, 'ps', '--all', '--quiet', '--orphans=false'], true)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const id of ids) {
    const state = JSON.parse(
      docker(['inspect', '--format', '{{json .State}}', id], true)
    );
    if (state.Running && state.Health?.Status === 'unhealthy') {
      console.log(`Restarting unhealthy container ${id.slice(0, 12)}...`);
      docker(['restart', id]);
    }
  }

  // Final readiness gate.
  docker([
    ...compose,
    'up',
    '--detach',
    '--no-build',
    '--wait',
    '--wait-timeout',
    '120',
  ]);
}

function checkPort(port, name, host = '0.0.0.0') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () =>
      reject(
        new Error(
          `${name} port ${port} is unavailable on ${host}. Stop the conflicting service before starting Harmonia.`
        )
      )
    );
    server.listen(
      { port: Number(port), host, exclusive: true },
      () => server.close(resolve)
    );
  });
}


async function checkManagedDockerPort(
  port,
  name,
  managedContainer,
  docker,
  probe = checkPort
) {
  try {
    // Docker publishes these services on loopback, so probe the exact
    // address rather than 0.0.0.0. Windows can otherwise allow the wildcard
    // probe even while a native service owns 127.0.0.1:<port>.
    await probe(port, name, '127.0.0.1');
    return;
  } catch {
    const owners = docker(
      ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}'],
      true
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    if (owners.includes(managedContainer)) return;

    const ownerDetails = owners.length
      ? ` Conflicting Docker container(s): ${owners.join(', ')}.`
      : ' The owner appears to be a host process or service.';

    throw new Error(
      `${name} port ${port} is occupied outside Harmonia.${ownerDetails} Stop or remap it before starting Harmonia.`
    );
  }
}

async function checkOllama(env, fetchImpl = globalThis.fetch) {
  if (String(env.USE_OLLAMA || 'false').toLowerCase() !== 'true') return;
  if (typeof fetchImpl !== 'function') throw new Error('Ollama check requires Node.js 20+ with fetch support.');
  const base = new URL(env.OLLAMA_URL || 'http://localhost:11434');
  const url = new URL('/api/tags', base);
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(
      `USE_OLLAMA=true but Ollama is not reachable at ${base.origin}: ${error.message}`
    );
  }
}

async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log(
      [
        'Usage: pnpm start:all [--gpu] [--no-worker] [--no-tools]',
        'Starts MongoDB, optional Mongo Express, optional ML worker, backend, and frontend.',
        '--gpu enables NVIDIA runtime for selected model providers.',
        '--no-worker omits the ML worker.',
        '--no-tools omits Mongo Express.',
        'Docker must already be running.',
      ].join('\n')
    );
    return;
  }

  const envFile = path.join(root, '.env');
  const env = applicationEnvironment({
    ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}),
    ...process.env,
    HARMONIA_GPU_ENABLED: options.gpu ? 'true' : 'false',
  });
  const nx = path.join(root, 'node_modules', 'nx', 'bin', 'nx.js');
  if (!existsSync(nx)) throw new Error('Dependencies are missing. Run pnpm install first.');

  await checkPort(env.PORT, 'Backend');
  await checkPort(4200, 'Frontend');

  const docker = (dockerArgs, capture) => run('docker', dockerArgs, env, capture);
  docker(['info', '--format', '{{.ServerVersion}}'], true);
  docker(['compose', 'version'], true);

  // Fail before an expensive ML reconciliation if a host service or unrelated
  // container already owns Harmonia's published database/tooling ports.
  await checkManagedDockerPort(
    27017,
    'MongoDB',
    'harmonia-mongo-i9',
    docker
  );
  if (options.tools) {
    await checkManagedDockerPort(
      8081,
      'Mongo Express',
      'harmonia-mongo-ui',
      docker
    );
  }

  const compose = composeArguments(options);
  docker([...compose, 'config', '--quiet']);

  console.log('Reconciling Docker services (first ML build may take a while)...');
  reconcileDocker(docker, compose, { build: options.worker });

  // Test the actual application credentials, not only the container's root healthcheck.
  const mongoose = require('mongoose');
  const connection = mongoose.createConnection(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    await connection.db.admin().ping();
  } catch {
    throw new Error(
      'MongoDB application connection failed. Check MONGODB_URI and existing database credentials; changing .env does not update users in an existing volume.'
    );
  } finally {
    await connection.close();
  }

  await checkOllama(env);

  console.log(
    `Database ready. Starting backend on ${env.PORT} and frontend on 4200.\nCtrl+C stops the app servers; Docker services remain running.`
  );
  run(
    process.execPath,
    [nx, 'run-many', '--target=serve', '--projects=frontend,backend', '--parallel=2'],
    env
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  applicationEnvironment,
  checkManagedDockerPort,
  checkOllama,
  checkPort,
  composeArguments,
  main,
  parseOptions,
  reconcileDocker,
  run,
};
