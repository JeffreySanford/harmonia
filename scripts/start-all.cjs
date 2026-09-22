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
  if (env.PORT && env.PORT !== '3000') throw new Error('start:all requires PORT=3000 to match the frontend API configuration.');
  return {
    ...env,
    PORT: env.PORT || '3000',
    MONGODB_URI: env.MONGODB_URI || `mongodb://harmonia_app:${encodeURIComponent(env.MONGO_HARMONIA_PASSWORD)}@127.0.0.1:27017/harmonia?authSource=harmonia`,
    MONGO_EXPRESS_URL: `mongodb://admin:${encodeURIComponent(env.MONGO_ROOT_PASSWORD)}@mongo:27017/`,
  };
}

function reconcileDocker(docker, compose) {
  // BuildKit provenance contains timestamps, which can change an otherwise cached
  // image's digest. Local dev builds omit it so clean containers keep their IDs.
  docker([...compose, 'build', '--provenance=false']);
  // Recover unhealthy dependencies before Compose waits on depends_on conditions.
  const ids = docker([...compose, 'ps', '--all', '--quiet', '--orphans=false'], true).trim().split(/\s+/).filter(Boolean);
  for (const id of ids) {
    const state = JSON.parse(docker(['inspect', '--format', '{{json .State}}', id], true));
    if (state.Running && state.Health?.Status === 'unhealthy') {
      console.log(`Restarting unhealthy container ${id.slice(0, 12)}...`);
      docker(['restart', id]);
    }
  }
  // Cached builds detect changed build inputs. Up creates/starts/recreates only as needed.
  // --wait requires healthchecks to pass (or running state for interactive ML containers).
  docker([...compose, 'up', '--detach', '--no-build', '--wait', '--wait-timeout', '120']);
}

function checkPort(port, name) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`${name} port ${port} is unavailable. Stop the conflicting service before starting Harmonia.`)));
    server.listen({ port: Number(port), host: '0.0.0.0', exclusive: true }, () => server.close(resolve));
  });
}

async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Usage: pnpm start:all [--no-worker]\nStarts MongoDB, Mongo Express, ML container, NVIDIA worker, backend and frontend.\n--no-worker omits the NVIDIA-only worker. Docker must already be running.');
    return;
  }
  if (args.some((arg) => arg !== '--no-worker')) throw new Error('Unknown option. Use --help for usage.');
  const envFile = path.join(root, '.env');
  const env = applicationEnvironment({ ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}), ...process.env });
  const nx = path.join(root, 'node_modules', 'nx', 'bin', 'nx.js');
  if (!existsSync(nx)) throw new Error('Dependencies are missing. Run pnpm install first.');
  await checkPort(env.PORT, 'Backend');
  await checkPort(4200, 'Frontend');
  const docker = (dockerArgs, capture) => run('docker', dockerArgs, env, capture);
  docker(['info', '--format', '{{.ServerVersion}}'], true);
  docker(['compose', 'version'], true);
  const compose = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.mongo.yml'];
  if (!args.includes('--no-worker')) compose.push('-f', 'docker-compose.dev.yml');
  docker([...compose, 'config', '--quiet']);
  console.log('Reconciling Docker services (first ML builds may take a while)...');
  reconcileDocker(docker, compose);

  // Test the actual application credentials, not only the container's root healthcheck.
  const mongoose = require('mongoose');
  const connection = mongoose.createConnection(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await connection.asPromise();
    await connection.db.admin().ping();
  } catch {
    throw new Error('MongoDB application connection failed. Check MONGODB_URI and existing database credentials; changing .env does not update users in an existing volume.');
  } finally {
    await connection.close();
  }

  console.log(`Database ready. Starting backend on ${env.PORT} and frontend on 4200.\nCtrl+C stops the app servers; Docker services remain running.`);
  // Launch Nx with Node directly so Windows does not require a Bash or cmd wrapper.
  run(process.execPath, [nx, 'run-many', '--target=serve', '--projects=frontend,backend', '--parallel=2'], env);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { applicationEnvironment, checkPort, main, reconcileDocker, run };
