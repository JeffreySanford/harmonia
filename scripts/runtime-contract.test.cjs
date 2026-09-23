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
  assert.match(compose, /container_name:\s*harmonia-diffsinger/);
  assert.match(compose, /container_name:\s*harmonia-musicgen/);
  assert.match(compose, /model-diffsinger/);
  assert.match(compose, /model-musicgen/);
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
  const websocket = read('apps/frontend/src/app/services/websocket.service.ts');

  assert.match(env, /^PORT=3000$/m);
  assert.match(proxy, /localhost:3000/);
  assert.match(backend, /process\.env\.PORT \|\| 3000/);
  assert.match(playwright, /localhost:3000\/api\/__health/);
  assert.match(playwright, /localhost:4200/);
  assert.match(websocket, /localhost:3000/);
  assert.doesNotMatch(websocket, /localhost:3333/);
  assert.doesNotMatch(workflow, /localhost:3333/);
});

test('package exposes authoritative start, test, lint, and build commands', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.start, 'node scripts/start-all.cjs');
  assert.equal(pkg.scripts['start:all'], 'node scripts/start-all.cjs');
  assert.ok(pkg.scripts['test:all']);
  assert.ok(pkg.scripts['lint:all']);
  assert.equal(
    pkg.scripts.test,
    'nx run-many --target=test --projects=frontend,backend'
  );
  assert.equal(
    pkg.scripts['build:all'],
    'nx run-many --target=build --projects=frontend,backend'
  );
  assert.doesNotMatch(pkg.scripts.test, /--all/);
  assert.doesNotMatch(pkg.scripts['build:all'], /--all/);
  assert.equal(pkg.scripts['docker:build'], undefined);
  assert.equal(pkg.scripts['docker:run'], undefined);
  assert.equal(pkg.scripts.predev, undefined);
});

test('Mongo initialization never falls back to a default application password', () => {
  const init = read('scripts/mongo-init/01-init-harmonia-db.js');
  assert.match(init, /MONGO_HARMONIA_PASSWORD is required/);
  assert.doesNotMatch(init, /changeme/);
});

test('backend MusicGen execution targets the isolated provider container', () => {
  const service = read('apps/backend/src/songs/stem-export.service.ts');
  assert.match(service, /harmonia-musicgen/);
  assert.doesNotMatch(service, /harmonia-worker/);
  assert.doesNotMatch(service, /harmonia-dev/);
});


test('DiffSinger is isolated from the generic worker image', () => {
  const worker = read('Dockerfile.worker');
  const diffsinger = read('Dockerfile.diffsinger');
  const compose = read('docker-compose.yml');

  assert.doesNotMatch(worker, /\/opt\/DiffSinger|HiFi-GAN|openvpi\/DiffSinger/);
  assert.match(diffsinger, /openvpi\/DiffSinger/);
  assert.match(diffsinger, /entrypoint\.diffsinger\.sh/);
  assert.match(compose, /profiles:\s*\n\s*- model-diffsinger/);
  assert.match(
    compose,
    /\.\/models\/diffsinger:\/workspace\/models\/diffsinger/
  );
});

test('DiffSinger vocoder is cached outside the provider image', () => {
  const dockerfile = read('Dockerfile.diffsinger');
  const entrypoint = read('entrypoint.diffsinger.sh');

  assert.doesNotMatch(dockerfile, /0109_hifigan_bigpopcs_hop128\.zip/);
  assert.match(entrypoint, /0109_hifigan_bigpopcs_hop128\.zip/);
  assert.match(entrypoint, /Using cached DiffSinger vocoder/);
  assert.match(entrypoint, /harmonia-runtime-ready/);
});

test('Linux container entrypoints normalize Windows line endings', () => {
  const worker = read('Dockerfile.worker');
  const diffsinger = read('Dockerfile.diffsinger');
  const attributes = read('.gitattributes');

  assert.match(attributes, /\*\.sh\s+text\s+eol=lf/);
  assert.match(worker, /sed -i 's\/\\r\$\/\/' \/workspace\/entrypoint\.sh/);
  assert.match(
    diffsinger,
    /sed -i 's\/\\r\$\/\/' \/workspace\/entrypoint\.diffsinger\.sh/
  );
});


test('music generation UI exposes real runtime state and never fakes an audio artifact', () => {
  const component = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.ts'
  );
  const template = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.html'
  );

  assert.doesNotMatch(component, /sample-audio\.mp3/);
  assert.doesNotMatch(component, /setInterval\(/);
  assert.match(component, /MusicRuntimeActions\.selectModel/);
  assert.match(template, /Generation Engine/);
  assert.match(template, /disabledReason/);
  assert.match(template, /runtimeStatus/);
});

test('music model catalog includes local and higher-capacity disabled tiers', () => {
  const catalog = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );

  assert.match(catalog, /acestep-v15-turbo-06b/);
  assert.match(catalog, /acestep-v15-xl-4b/);
  assert.match(catalog, /stable-audio-3-medium/);
  assert.match(catalog, /songgeneration-v2-large/);
  assert.match(catalog, /yue2-3b/);
  assert.match(catalog, /muse-long-form/);
});

test('provider runtime lifecycle is driven by backend events and NgRx', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );
  const gateway = read(
    'apps/backend/src/music-runtime/music-runtime.gateway.ts'
  );
  const websocket = read(
    'apps/frontend/src/app/services/websocket.service.ts'
  );
  const effects = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime-notification.effects.ts'
  );

  for (const state of [
    'building',
    'starting',
    'health-checking',
    'healthy',
    'ready',
    'stopping',
  ]) {
    assert.match(backend, new RegExp(`'${state}'`));
  }
  assert.match(gateway, /music-runtime:status/);
  assert.match(websocket, /music-runtime:status/);
  assert.match(effects, /MatSnackBar/);
});


test('provider image builds stream progress instead of buffering Docker output', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(backend, /spawn\('docker'/);
  assert.match(backend, /--progress=plain/);
  assert.match(backend, /step \${current}\/\${total}/);
  assert.match(backend, /10_000/);
  assert.match(backend, /elapsed/);
  assert.match(backend, /child\.stdout\?\.on\('data'/);
  assert.match(backend, /child\.stderr\?\.on\('data'/);
});


test('MusicGen is isolated in its AudioCraft-compatible provider image', () => {
  const worker = read('Dockerfile.worker');
  const musicgen = read('Dockerfile.musicgen');
  const compose = read('docker-compose.yml');
  const catalog = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );

  assert.doesNotMatch(worker, /audiocraft/i);
  assert.match(musicgen, /python3\.9/);
  assert.match(musicgen, /torch==2\.1\.0/);
  assert.match(musicgen, /audiocraft==1\.3\.0/);
  assert.match(compose, /profiles:\s*\n\s*- model-musicgen/);
  assert.match(compose, /harmonia\/musicgen:dev/);
  assert.match(catalog, /musicgen-stereo-small/);
  assert.match(catalog, /musicgen-medium/);
  assert.match(catalog, /minVramGb: 16/);
});

test('provider image identity is catalog-driven rather than hard-coded', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );
  const catalog = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );

  assert.match(backend, /const imageName = provider\.imageName/);
  assert.match(catalog, /imageName: 'harmonia\/diffsinger:dev'/);
  assert.match(catalog, /imageName: 'harmonia\/musicgen:dev'/);
});


test('runtime ownership is recovered from Docker before model switching', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(backend, /reconcileRuntimeOwnership/);
  assert.match(backend, /Multiple model runtimes were running after state recovery/);
  assert.match(backend, /Recovered running \${recovered\.provider\.name} runtime after backend restart/);
  assert.match(backend, /all were stopped to protect GPU ownership/);
  assert.match(backend, /await this\.reconcileRuntimeOwnership\(\)/);
});
