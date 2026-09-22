const assert = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('runtime uses one canonical Compose definition plus an optional GPU override', () => {
  assert.equal(existsSync(path.join(root, 'docker-compose.yml')), true);
  assert.equal(existsSync(path.join(root, 'docker-compose.gpu.yml')), true);
  assert.equal(existsSync(path.join(root, 'docker-compose.mongo.yml')), false);
  assert.equal(existsSync(path.join(root, 'docker-compose.dev.yml')), false);

  const compose = read('docker-compose.yml');
  assert.match(compose, /container_name:\s*harmonia-worker/);
  assert.match(compose, /127\.0\.0\.1:27017:27017/);
  assert.match(compose, /127\.0\.0\.1:8081:8081/);
  assert.doesNotMatch(compose, /8000:8000/);
});

test('application port contract is 4200 frontend and 3000 backend', () => {
  const env = read('.env.example');
  const proxy = read('apps/frontend/proxy.conf.json');
  const backend = read('apps/backend/src/main.ts');
  const playwright = read('playwright.config.ts');
  const workflow = read('docs/DEVELOPMENT_WORKFLOW.md');

  assert.match(env, /^PORT=3000$/m);
  assert.match(proxy, /localhost:3000/);
  assert.match(backend, /process\.env\.PORT \|\| 3000/);
  assert.match(playwright, /localhost:3000\/api\/__health/);
  assert.match(playwright, /localhost:4200/);
  assert.doesNotMatch(workflow, /localhost:3333/);
});

test('package exposes authoritative start, test, lint, and build commands', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.start, 'node scripts/start-all.cjs');
  assert.equal(pkg.scripts['start:all'], 'node scripts/start-all.cjs');
  assert.ok(pkg.scripts['test:all']);
  assert.ok(pkg.scripts['lint:all']);
  assert.ok(pkg.scripts['build:all']);
  assert.equal(pkg.scripts['docker:build'], undefined);
  assert.equal(pkg.scripts['docker:run'], undefined);
  assert.equal(pkg.scripts.predev, undefined);
});

test('Mongo initialization never falls back to a default application password', () => {
  const init = read('scripts/mongo-init/01-init-harmonia-db.js');
  assert.match(init, /MONGO_HARMONIA_PASSWORD is required/);
  assert.doesNotMatch(init, /changeme/);
});

test('backend Docker execution target matches the canonical worker name', () => {
  const service = read('apps/backend/src/songs/stem-export.service.ts');
  assert.match(service, /harmonia-worker/);
  assert.doesNotMatch(service, /harmonia-dev/);
});
