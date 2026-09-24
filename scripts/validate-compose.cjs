#!/usr/bin/env node
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  MONGO_ROOT_PASSWORD: process.env.MONGO_ROOT_PASSWORD || 'compose-validation-root',
  MONGO_HARMONIA_PASSWORD:
    process.env.MONGO_HARMONIA_PASSWORD || 'compose-validation-app',
  MONGO_WIREDTIGER_CACHE_GB: process.env.MONGO_WIREDTIGER_CACHE_GB || '2',
  MONGO_MAX_CONNS: process.env.MONGO_MAX_CONNS || '500',
  HF_TOKEN: process.env.HF_TOKEN || '',
  HUGGING_FACE_HUB_TOKEN: process.env.HUGGING_FACE_HUB_TOKEN || '',
  HUGGINGFACE_HUB_TOKEN: process.env.HUGGINGFACE_HUB_TOKEN || '',
};

function compose(args) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  if (result.error) {
    throw new Error(`Cannot run docker compose: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'docker compose failed');
  }
  return result.stdout;
}

const args = [
  '-f',
  'docker-compose.yml',
  '--profile',
  'worker',
  '--profile',
  'tools',
];
compose([...args, 'config', '--quiet']);
compose([
  '-f',
  'docker-compose.yml',
  '-f',
  'docker-compose.gpu.yml',
  '--profile',
  'worker',
  '--profile',
  'tools',
  '--profile',
  'model-diffsinger',
  '--profile',
  'model-musicgen',
  '--profile',
  'model-stable-audio-3',
  'config',
  '--quiet',
]);

const config = JSON.parse(compose([...args, 'config', '--format', 'json']));
for (const name of ['mongo', 'mongo-express', 'worker']) {
  assert.ok(config.services[name], `Missing Compose service: ${name}`);
}
assert.equal(config.services.worker.container_name, 'harmonia-worker');

const providerConfig = JSON.parse(
  compose([
    '-f',
    'docker-compose.yml',
    '-f',
    'docker-compose.gpu.yml',
    '--profile',
    'model-diffsinger',
    '--profile',
    'model-musicgen',
    '--profile',
    'model-stable-audio-3',
    'config',
    '--format',
    'json',
  ])
);
assert.equal(
  providerConfig.services.diffsinger.container_name,
  'harmonia-diffsinger'
);
assert.equal(
  providerConfig.services.musicgen.container_name,
  'harmonia-musicgen'
);
assert.equal(
  providerConfig.services['stable-audio-3'].container_name,
  'harmonia-stable-audio-3'
);

const publishedPorts = Object.values(config.services)
  .flatMap((service) => service.ports || [])
  .map((port) => Number(port.published))
  .filter(Number.isFinite)
  .sort((a, b) => a - b);

assert.deepEqual(publishedPorts, [8081, 27017]);
console.log(
  'Compose contract valid: MongoDB 27017, Mongo Express 8081, generic worker plus isolated DiffSinger/MusicGen/Stable Audio 3 providers have no published ports.'
);
