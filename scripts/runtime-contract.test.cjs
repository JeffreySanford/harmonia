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
  const auth = read('apps/frontend/src/app/services/auth.service.ts');

  assert.match(env, /^PORT=3000$/m);
  assert.match(proxy, /localhost:3000/);
  assert.match(proxy, /"\/downloads"/);
  assert.match(auth, /private readonly apiUrl = '\/api\/auth'/);
  assert.doesNotMatch(auth, /localhost:3000\/api\/auth/);
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


test('backend never falls back to unauthenticated MongoDB access', () => {
  const appModule = read('apps/backend/src/app/app.module.ts');

  assert.match(appModule, /MONGO_HARMONIA_PASSWORD/);
  assert.match(appModule, /harmonia_app/);
  assert.match(appModule, /authSource=harmonia/);
  assert.match(appModule, /encodeURIComponent\(appPassword\)/);
  assert.doesNotMatch(appModule, /mongodb:\/\/localhost:27017\/harmonia/);
});


test('local auth repair synchronizes app credentials and seeds the test user', () => {
  const pkg = JSON.parse(read('package.json'));
  const repair = read('scripts/repair-local-db-auth.cjs');

  assert.equal(
    pkg.scripts['repair:local-auth'],
    'node scripts/repair-local-db-auth.cjs'
  );
  assert.match(repair, /crypto\.randomBytes\(24\)/);
  assert.match(repair, /h\.updateUser\("harmonia_app"/);
  assert.match(repair, /h\.createUser\(\{ user: "harmonia_app"/);
  assert.match(repair, /E2E_TEST_USER_USERNAME/);
  assert.match(repair, /E2E_TEST_USER_PASSWORD/);
  assert.match(repair, /LOCAL_DB_AUTH_REPAIR_OK/);
  assert.doesNotMatch(repair, /MONGO_HARMONIA_PASSWORD=.*password/i);
});


test('MusicGen Small qualification exercises persistent generation and downloads', () => {
  const pkg = JSON.parse(read('package.json'));
  const qualify = read('scripts/qualify-musicgen-small.cjs');

  assert.equal(
    pkg.scripts['qualify:musicgen-small'],
    'node scripts/qualify-musicgen-small.cjs'
  );
  assert.match(qualify, /modelId: 'musicgen-small'/);
  assert.match(qualify, /\/api\/jobs/);
  assert.match(qualify, /\/downloads\/jobs\//);
  assert.match(qualify, /RIFF/);
  assert.match(qualify, /WAVE/);
  assert.match(qualify, /MUSICGEN_SMALL_QUALIFICATION_OK/);
});

test('Storybook bootstrap covers actual login and music-generation UI', () => {
  const pkg = JSON.parse(read('package.json'));
  const setup = read('scripts/setup-storybook.cjs');
  const loginStory = read(
    'apps/frontend/src/app/features/auth/login-modal/login-modal.component.stories.ts'
  );
  const musicStory = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.stories.ts'
  );

  assert.equal(
    pkg.scripts['storybook:setup'],
    'node scripts/setup-storybook.cjs'
  );
  assert.match(setup, /@nx\/storybook@22\.1\.3/);
  assert.match(setup, /run\(\['add', '-D', '-w', '@nx\/storybook@22\.1\.3'\]\)/);
  assert.match(setup, /const pnpm = 'pnpm'/);
  assert.match(setup, /shell: process\.platform === 'win32'/);
  assert.match(setup, /@nx\/angular:storybook-configuration/);
  assert.match(setup, /--interactionTests=true/);
  assert.match(setup, /--generateStories=false/);
  assert.match(setup, /build-storybook/);
  assert.match(setup, /nx run frontend:test-storybook/);
  assert.match(setup, /port 4400/);
  assert.match(setup, /--ci=true/);
  assert.match(setup, /--noOpen=true/);
  assert.match(setup, /--host=127\.0\.0\.1/);
  assert.match(setup, /normalizeGeneratedStorybookConfig/);
  assert.match(setup, /fileURLToPath/);
  assert.match(setup, /dirname/);

  assert.match(loginStory, /LoginModalComponent/);
  assert.match(loginStory, /ValidLoginDispatchesRealAuthAction/);
  assert.match(loginStory, /AuthActions\.login/);
  assert.match(loginStory, /PasswordValidation/);

  assert.match(musicStory, /MusicGenerationPageComponent/);
  assert.match(musicStory, /GenerateMusicDispatchesPersistentJob/);
  assert.match(musicStory, /JobsActions\.createJob/);
  assert.match(musicStory, /CompletedGenerationShowsAudioPlayer/);
  assert.match(musicStory, /\/downloads\/jobs\/storybook-musicgen-job\/music\.wav/);
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


test('music generation UI submits real jobs and never fakes an audio artifact', () => {
  const component = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.ts'
  );
  const template = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.html'
  );
  const jobs = read('apps/backend/src/jobs/jobs.service.ts');
  const controller = read('apps/backend/src/jobs/jobs.controller.ts');
  const compose = read('docker-compose.yml');

  assert.doesNotMatch(component, /sample-audio\.mp3/);
  assert.doesNotMatch(component, /Audio generation wiring is the next/);
  assert.doesNotMatch(component, /setInterval\(/);
  assert.match(component, /MusicRuntimeActions\.selectModel/);
  assert.match(component, /JobsActions\.createJob/);
  assert.match(component, /jobType: 'generate'/);
  assert.match(controller, /@Controller\('jobs'\)/);
  assert.match(jobs, /processGenerationJob/);
  assert.match(jobs, /validateWav/);
  assert.match(jobs, /exports', 'jobs', jobId/);
  assert.match(jobs, /musicgen_provider_client\.py/);
  assert.match(compose, /\.\/exports:\/workspace\/exports/);
  assert.match(template, /Generation Engine/);
  assert.match(template, /generatedAudioUrl/);
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
  assert.match(musicgen, /bootstrap\.pypa\.io\/pip\/3\.9\/get-pip\.py/);
  assert.doesNotMatch(musicgen, /bootstrap\.pypa\.io\/get-pip\.py/);
  assert.match(musicgen, /torch==2\.1\.0/);
  assert.match(musicgen, /audiocraft==1\.3\.0/);
  assert.match(musicgen, /numpy<2\.0\.0/);
  assert.match(musicgen, /thinc==8\.2\.5/);
  assert.match(musicgen, /spacy==3\.7\.6/);
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
  assert.match(backend, /Recovered running \${recovered\.provider\.name}/);
  assert.match(backend, /all were stopped to protect GPU ownership/);
  assert.match(backend, /await this\.reconcileRuntimeOwnership\(\)/);
});


test('MusicGen startup validates dependencies once and healthcheck uses readiness sentinel', () => {
  const compose = read('docker-compose.yml');
  const entrypoint = read('entrypoint.musicgen.sh');
  const server = read('scripts/musicgen_provider_server.py');
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(entrypoint, /import torch/);
  assert.match(entrypoint, /import audiocraft/);
  assert.match(server, /READY_FILE\.touch\(\)/);
  assert.match(server, /ThreadingHTTPServer/);
  assert.match(compose, /test -f \/tmp\/harmonia-runtime-ready/);
  assert.match(compose, /127\.0\.0\.1:8765\/health/);
  assert.doesNotMatch(
    compose,
    /python3\.9 -c 'import torch, audiocraft/
  );
  assert.match(backend, /failingStreak=/);
  assert.match(backend, /'logs',[\s\S]*'--tail',[\s\S]*'40'/);
});


test('provider lifecycle is orchestrator-owned and unhealthy runtimes fail fast', () => {
  const compose = read('docker-compose.yml');
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  const providerRestartPolicies =
    compose.match(/container_name:\s*harmonia-(?:diffsinger|musicgen)[\s\S]{0,80}restart:\s*"no"/g) || [];
  assert.equal(providerRestartPolicies.length, 2);
  assert.match(backend, /state\.Health\?\.Status === 'unhealthy'/);
  assert.match(backend, /became unhealthy/);
});


test('MusicGen pins Transformers to a PyTorch 2.1-compatible release', () => {
  const musicgen = read('Dockerfile.musicgen');

  assert.match(musicgen, /transformers==4\.35\.2/);
  assert.match(musicgen, /MusicGen Python stack import check passed/);
  assert.match(musicgen, /torch\.__version__\.startswith\("2\.1\.0"\)/);
});


test('provider selection reconciles stale images once per backend process', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(backend, /validatedProviderImages = new Set<string>\(\)/);
  assert.match(backend, /validatedProviderImages\.has\(provider\.id\)/);
  assert.match(backend, /Checking \${provider\.name} runtime image for source changes/);
  assert.match(backend, /validatedProviderImages\.add\(provider\.id\)/);
});


test('backend MusicGen failures propagate instead of synthesizing placeholder audio', () => {
  const service = read('apps/backend/src/songs/stem-export.service.ts');

  assert.doesNotMatch(service, /generateBasicInstrumentAudio/);
  assert.doesNotMatch(service, /generateWavPlaceholder/);
  assert.doesNotMatch(service, /using basic instrument audio/i);
  assert.match(service, /reject\(new Error\(/);
});

test('generic worker excludes heavyweight model frameworks', () => {
  const requirements = read('requirements.worker.txt');
  const gpu = read('docker-compose.gpu.yml');
  const startup = read('scripts/start-all.cjs');

  for (const packageName of [
    'torch',
    'torchaudio',
    'huggingface_hub',
    'soundfile',
    'scipy',
    'audiocraft',
  ]) {
    assert.doesNotMatch(requirements, new RegExp(packageName, 'i'));
  }

  assert.doesNotMatch(gpu, /^\s*worker:\s*$/m);
  assert.doesNotMatch(startup, /--gpu cannot be combined with --no-worker/);
  assert.match(startup, /--gpu enables NVIDIA runtime for selected model providers/);
});


test('MusicGen generation reuses a resident provider model', () => {
  const dockerfile = read('Dockerfile.musicgen');
  const compose = read('docker-compose.yml');
  const server = read('scripts/musicgen_provider_server.py');
  const client = read('scripts/musicgen_provider_client.py');
  const stems = read('apps/backend/src/songs/stem-export.service.ts');
  const runtime = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );
  const catalog = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );

  assert.match(dockerfile, /musicgen_provider_server\.py/);
  assert.match(dockerfile, /musicgen_provider_client\.py/);
  assert.match(compose, /musicgen_provider_server\.py/);
  assert.doesNotMatch(compose, /musicgen:[\s\S]{0,600}sleep[\s\S]{0,20}infinity/);
  assert.match(server, /Reusing resident MusicGen model/);
  assert.match(server, /torch\.cuda\.empty_cache\(\)/);
  assert.match(client, /127\.0\.0\.1:8765\/generate/);
  assert.match(stems, /musicgen_provider_client\.py/);
  assert.match(stems, /concatMap/);
  assert.match(stems, /defer\(\(\) =>/);
  assert.match(runtime, /'busy'/);
  assert.match(runtime, /beginGeneration/);
  assert.match(runtime, /finishGeneration/);
  assert.match(catalog, /runtimeModelId: 'facebook\/musicgen-small'/);
  assert.match(
    catalog,
    /runtimeModelId: 'facebook\/musicgen-stereo-small'/
  );
});


test('backend restart recovers resident MusicGen model and busy state', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(backend, /recoverProviderRuntimeSnapshot/);
  assert.match(backend, /127\.0\.0\.1:8765\/health/);
  assert.match(backend, /candidate\.runtimeModelId === snapshot\.model/);
  assert.match(backend, /snapshot\.busy/);
  assert.match(backend, /recoveredModelLabel/);
  assert.match(backend, /shouldRecoverSnapshot/);
  assert.match(backend, /!this\.status\.modelId/);
  assert.match(backend, /this\.status\.state === 'busy'/);
});

test('provider unhealthy state escapes the health wait loop immediately', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(backend, /error\.message\.includes\('became unhealthy'\)/);
});
