const assert = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const walkFiles = (relativeDir) => {
  const base = path.join(root, relativeDir);
  const files = [];

  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }

  return files;
};

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
  assert.match(auth, /private readonly apiUrl\s*=\s*['\"]\/api\/auth['\"]/);
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

test('CI enforces the root strict TypeScript-zero contract', () => {
  const pkg = JSON.parse(read('package.json'));
  const ci = read('.github/workflows/ci.yml');

  assert.equal(
    pkg.scripts.typecheck,
    'tsc -p . --noEmit'
  );

  assert.match(
    ci,
    /- name: Strict TypeScript check\s+run: pnpm typecheck/
  );

  const typecheckIndex = ci.indexOf(
    'run: pnpm typecheck'
  );

  const buildIndex = ci.indexOf(
    'run: pnpm build:all'
  );

  assert.ok(
    typecheckIndex >= 0,
    'CI must run root strict TypeScript'
  );

  assert.ok(
    buildIndex > typecheckIndex,
    'root typecheck must run before application builds'
  );
});

test('CI reads the pinned pnpm version from packageManager', () => {
  const pkg = JSON.parse(read('package.json'));
  const ci = read('.github/workflows/ci.yml');
  const mongooseWorkflow = read('.github/workflows/test_mongoose.yml');

  assert.equal(pkg.packageManager, 'pnpm@12.6.0');

  for (const workflow of [ci, mongooseWorkflow]) {
    assert.match(workflow, /uses: pnpm\/action-setup@v4/);
    assert.doesNotMatch(workflow, /version:\s*10\.23\.0/);
  }
});

test('hosted smoke CI skips absent local artifacts without opening alert storms', () => {
  const smoke = read('tests/env_tests/smoke_check.py');
  const workflow = read('.github/workflows/smoke.yml');
  const pkg = JSON.parse(read('package.json'));
  const wsl = read('scripts/qualify-wsl-ci.sh');

  assert.match(smoke, /successful skip/);
  assert.match(smoke, /normalize_artifact_path/);
  assert.doesNotMatch(workflow, /actions\/cache@/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.match(workflow, /search\.issuesAndPullRequests/);
  assert.match(workflow, /createComment/);
  assert.equal(pkg.scripts['qualify:wsl-ci'], 'bash scripts/qualify-wsl-ci.sh');
  assert.match(wsl, /RUN_DOCKER_START_TESTS=1/);
  assert.match(wsl, /NX_NO_CLOUD=true/);
  assert.match(wsl, /HARMONIA_WSL_CI_PARITY_OK/);
});

test('all Nx packages are aligned on 22.7.12', () => {
  const pkg = JSON.parse(read('package.json'));
  const nxPackages = [
    '@nx/angular',
    '@nx/devkit',
    '@nx/eslint',
    '@nx/eslint-plugin',
    '@nx/jest',
    '@nx/js',
    '@nx/nest',
    '@nx/node',
    '@nx/playwright',
    '@nx/storybook',
    '@nx/web',
    '@nx/webpack',
    '@nx/workspace',
    'nx',
  ];

  for (const name of nxPackages) {
    assert.equal(pkg.devDependencies[name], '22.7.12', `${name} must match Nx 22.7.12`);
  }
});

test('dependency build scripts use pnpm 12 allowBuilds policy', () => {
  const workspace = read('pnpm-workspace.yaml');

  assert.match(workspace, /^allowBuilds:$/m);
  assert.match(workspace, /'@parcel\/watcher@2\.5\.1 \|\| 2\.6\.0': true/);
  assert.match(workspace, /'unrs-resolver@1\.11\.1 \|\| 1\.12\.2': true/);
  assert.match(workspace, /'@swc\/core@1\.5\.29': true/);
  assert.match(
    workspace,
    /'esbuild@0\.25\.9 \|\| 0\.25\.12 \|\| 0\.27\.0 \|\| 0\.28\.1': true/
  );
  assert.match(workspace, /'lmdb@3\.4\.2': true/);
  assert.match(workspace, /'msgpackr-extract@3\.0\.3': true/);
  assert.match(workspace, /'nx@22\.7\.12': true/);
  assert.match(workspace, /^strictDepBuilds:\s*true$/m);
  assert.doesNotMatch(workspace, /onlyBuiltDependencies:/);
  assert.doesNotMatch(workspace, /dangerouslyAllowAllBuilds:\s*true/);
});

test('Windows startup disables Nx plugin isolation to avoid plugin worker hangs', () => {
  const startup = read('scripts/start-all.cjs');

  assert.match(startup, /process\.platform === 'win32' \? 'false' : undefined/);
  assert.match(startup, /NX_ISOLATE_PLUGINS/);
});


test('backend Node runtime packages are production dependencies', () => {
  const packageJson = JSON.parse(read('package.json'));

  const dependencies = packageJson.dependencies ?? {};
  const devDependencies = packageJson.devDependencies ?? {};

  const runtimePackages = [
    '@nestjs/bull',
    '@nestjs/common',
    '@nestjs/config',
    '@nestjs/core',
    '@nestjs/jwt',
    '@nestjs/mongoose',
    '@nestjs/passport',
    '@nestjs/platform-express',
    '@nestjs/platform-socket.io',
    '@nestjs/websockets',
    'bull',
    'class-transformer',
    'class-validator',
    'mongoose',
    'passport',
    'passport-jwt',
    'rxjs',
    'socket.io',
  ];

  for (const packageName of runtimePackages) {
    assert.ok(
      dependencies[packageName],
      `${packageName} must be a production dependency`,
    );

    assert.ok(
      !devDependencies[packageName],
      `${packageName} must not remain a devDependency`,
    );
  }

  assert.ok(
    devDependencies['mongodb-memory-server'],
    'mongodb-memory-server must remain test-only tooling',
  );

  assert.ok(
    !dependencies['mongodb-memory-server'],
    'mongodb-memory-server must never become a runtime dependency',
  );
});

test('mongodb-memory-server is isolated to test tooling', () => {
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.dependencies['mongodb-memory-server'],
    undefined
  );

  assert.ok(
    pkg.devDependencies['mongodb-memory-server']
  );

  assert.equal(
    pkg.scripts['test:mongo-memory'],
    'node scripts/test_mongoose_memory.js'
  );

  assert.equal(
    pkg.scripts['test:mongo'],
    'pnpm test:mongo-memory'
  );

  const backendFiles = walkFiles('apps/backend')
    .filter((file) => /\.(?:ts|js|cjs|mjs)$/.test(file));

  for (const file of backendFiles) {
    const source = read(file);

    assert.doesNotMatch(
      source,
      /mongodb-memory-server|MongoMemoryServer/,
      `${file} must not depend on in-memory MongoDB`
    );
  }

  const compose = read('docker-compose.yml');
  const appModule = read(
    'apps/backend/src/app/app.module.ts'
  );

  assert.match(
    compose,
    /image:\s*mongo:7\.0/
  );

  assert.match(
    compose,
    /mongo-data:\/data\/db/
  );

  assert.match(
    appModule,
    /MongooseModule\.forRootAsync/
  );

  assert.match(
    appModule,
    /MONGODB_URI/
  );

  assert.match(
    appModule,
    /127\.0\.0\.1:27017\/harmonia\?authSource=harmonia/
  );
});


test('Mongo initialization never falls back to a default application password', () => {
  const init = read('scripts/mongo-init/01-init-harmonia-db.js');
  assert.match(init, /MONGO_HARMONIA_PASSWORD is required/);
  assert.doesNotMatch(init, /changeme/);
});

test('Mongo jobs validator matches the persistent JobRecord contract', () => {
  const init = read('scripts/mongo-init/01-init-harmonia-db.js');
  const repair = read('scripts/repair-local-db-auth.cjs');
  const schema = read('apps/backend/src/schemas/job-record.schema.ts');

  for (const source of [init, repair]) {
    assert.match(source, /required: \['userId', 'jobType', 'status'\]/);
    assert.match(source, /'generate'.*'convert'.*'analyze'.*'train'/s);
    assert.match(
      source,
      /'pending'.*'queued'.*'processing'.*'completed'.*'failed'.*'cancelled'/s
    );
    assert.doesNotMatch(source, /required: \['type', 'status'\]/);
    assert.doesNotMatch(source, /'running'.*'success'/s);
  }

  assert.match(schema, /jobType!?: JobRecordType/);
  assert.match(schema, /status!?: JobRecordStatus/);
  assert.match(repair, /collMod: "jobs"/);
  assert.match(repair, /JOBS_SCHEMA_SYNC_OK/);
  assert.match(repair, /status_1_worker_id_1/);
  assert.match(repair, /type_1_created_at_-1/);
  assert.match(init, /userId: 1, status: 1, createdAt: -1/);
  assert.match(init, /userId: 1, jobType: 1, createdAt: -1/);
});


test('model installation Mongo contract is consistent across fresh, existing, and backend schemas', () => {
  const init = read('scripts/mongo-init/01-init-harmonia-db.js');
  const sync = read('scripts/sync-model-installations-schema.cjs');
  const schema = read(
    'apps/backend/src/schemas/model-installation.schema.ts'
  );
  const pkg = JSON.parse(read('package.json'));

  for (const source of [init, sync]) {
    assert.match(
      source,
      /model_installations/
    );
    assert.match(
      source,
      /artifactId.*providerId.*modelIds.*runtimeModelIds.*sourceKind.*sourceRef.*localPath.*status.*verificationStrategy.*licenseAcceptanceRequired.*gated/s
    );
    assert.match(
      source,
      /'missing'.*'verified'.*'degraded'.*'corrupt'.*'unavailable'.*'failed'/s
    );
    assert.match(
      source,
      /artifactId: 1.*unique: true/s
    );
    assert.match(
      source,
      /providerId: 1, status: 1/
    );
    assert.match(
      source,
      /status: 1, verifiedAt: -1/
    );
    assert.match(
      source,
      /modelIds: 1/
    );
    assert.match(
      source,
      /additionalProperties: false/
    );
    assert.match(
      source,
      /_id: \{ bsonType: 'objectId' \}/
    );
    assert.equal(
      source.includes(
        "pattern: '^(?!/)(?![A-Za-z]:"
      ),
      true
    );
  }

  assert.match(
    schema,
    /collection: 'model_installations'/
  );
  assert.match(
    schema,
    /versionKey: false/
  );
  assert.match(
    schema,
    /export type ModelInstallationStatus/
  );
  assert.match(
    schema,
    /artifactId!?: string/
  );
  assert.match(
    schema,
    /localPath!?: string/
  );
  assert.match(
    schema,
    /status!?: ModelInstallationStatus/
  );
  assert.match(
    schema,
    /sourceRevision!?: string \| null/
  );
  assert.match(
    schema,
    /verifiedAt!?: Date \| null/
  );
  assert.match(
    schema,
    /installedAt!?: Date \| null/
  );
  assert.match(
    schema,
    /lastUsedAt!?: Date \| null/
  );
  assert.match(
    schema,
    /lastError!?: string \| null/
  );

  assert.equal(
    pkg.scripts['models:db-schema'],
    'node scripts/sync-model-installations-schema.cjs'
  );

  assert.match(
    sync,
    /collMod: "model_installations"/
  );
  assert.match(
    sync,
    /MODEL_INSTALLATIONS_SCHEMA_SYNC_OK/
  );

  for (const source of [init, sync, schema]) {
    assert.doesNotMatch(
      source,
      /accessToken|authorizationHeader|checkpointBytes|wavPayload/i
    );
  }
});

test('runtime model selection enforces filesystem readiness before provider switch and records usage after ready', () => {
  const service = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );
  const readiness = read(
    'apps/backend/src/music-runtime/model-installation-runtime.service.ts'
  );
  const module = read(
    'apps/backend/src/music-runtime/music-runtime.module.ts'
  );

  const readinessMatch = service.match(
    /await this\.modelInstallations\.assertModelReady\(model\.id\)/
  );

  const stopMatch = service.match(
    /await this\.stopCurrentRuntime\(\s*operationId\s*\)/
  );

  const imageMatch = service.match(
    /await this\.ensureProviderImage\(\s*provider,\s*model,\s*hardware,\s*operationId\s*\)/
  );

  const readinessIndex =
    readinessMatch?.index ?? -1;

  const stopIndex =
    stopMatch?.index ?? -1;

  const imageIndex =
    imageMatch?.index ?? -1;

  assert.ok(
    readinessIndex >= 0,
    'Expected filesystem readiness check in selectModel'
  );

  assert.ok(
    stopIndex >= 0,
    'Expected correlated provider stop after readiness'
  );

  assert.ok(
    imageIndex >= 0,
    'Expected correlated provider image reconciliation after readiness'
  );

  assert.ok(
    stopIndex > readinessIndex,
    'Filesystem readiness must precede provider shutdown'
  );

  assert.ok(
    imageIndex > readinessIndex,
    'Filesystem readiness must precede provider image reconciliation'
  );

  assert.match(
    service,
    /await this\.modelInstallations\.markModelUsed\(model\.id\)/
  );
  assert.match(
    readiness,
    /model-manager\.cjs/
  );
  assert.match(
    readiness,
    /'verify'/
  );
  assert.match(
    readiness,
    /'--model'/
  );
  assert.match(
    readiness,
    /'--root',[\s\S]*'models'/
  );
  assert.match(
    readiness,
    /'--offline'/
  );
  assert.match(
    readiness,
    /modelIds: modelId,[\s\S]*status: 'verified'/
  );
  assert.match(
    readiness,
    /lastUsedAt: usedAt/
  );
  assert.match(
    module,
    /MongooseModule\.forFeature/
  );
  assert.match(
    module,
    /ModelInstallationRuntimeService/
  );
  assert.match(
    module,
    /ModelInstallationSchema/
  );
});

test('runtime ownership recovery recognizes resident Stable Audio model state', () => {
  const service = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );
  const provider = read(
    'scripts/stable_audio_3_provider_server.py'
  );

  assert.match(
    service,
    /provider\.id === 'stable-audio-3'[\s\S]*8766/
  );
  assert.match(
    service,
    /provider\.id === 'musicgen'[\s\S]*'python3\.9'[\s\S]*'python3'/
  );
  assert.match(
    service,
    /candidate\.providerId === provider\.id[\s\S]*candidate\.runtimeModelId === snapshot\.model/
  );
  assert.match(
    provider,
    /"model": self\._model_name/
  );
  assert.match(
    provider,
    /"busy": self\._busy/
  );
  assert.match(
    provider,
    /HARMONIA_STABLE_AUDIO_3_PORT", "8766"/
  );
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
  assert.match(repair, /synchronizeJobsCollectionSchema\(\)/);
  assert.match(repair, /JOBS_SCHEMA_SYNC_OK/);
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

test('MusicGen Stereo Small qualification requires two-channel audio', () => {
  const qualifier = read('scripts/qualify-musicgen-stereo-small.cjs');
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.scripts['qualify:musicgen-stereo-small'],
    'node scripts/qualify-musicgen-stereo-small.cjs'
  );
  assert.match(qualifier, /musicgen-stereo-small/);
  assert.match(qualifier, /wav\.channels !== 2/);
  assert.match(qualifier, /MUSICGEN_STEREO_SMALL_QUALIFICATION_OK/);
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
  const musicModule = read(
    'apps/frontend/src/app/features/music-generation/music-generation.module.ts'
  );

  assert.equal(
    pkg.scripts['storybook:setup'],
    'node scripts/setup-storybook.cjs'
  );
  assert.match(setup, /@nx\/storybook@22\.7\.12/);
  assert.match(setup, /@storybook\/test-runner@\^0\.24\.0/);
  assert.match(setup, /run\(\['add', '-D', '-w', '@nx\/storybook@22\.7\.12'\]\)/);
  assert.match(setup, /const pnpm = 'pnpm'/);
  assert.match(setup, /shell: process\.platform === 'win32'/);
  assert.match(setup, /@nx\/angular:storybook-configuration/);
  assert.match(setup, /--interactionTests=true/);
  assert.match(setup, /--generateStories=false/);
  assert.match(setup, /build-storybook/);
  assert.match(setup, /node scripts\/run-storybook-tests\.cjs/);
  assert.match(setup, /storybookPort = 4401/);
  assert.match(setup, /--ci=true/);
  assert.doesNotMatch(setup, /--noOpen=true/);
  assert.match(setup, /--host=127\.0\.0\.1/);
  assert.match(setup, /normalizeGeneratedStorybookTargets/);
  assert.match(setup, /test-storybook/);
  const storybookRunner = read('scripts/run-storybook-tests.cjs');
  assert.match(storybookRunner, /getFreePort/);
  assert.match(storybookRunner, /\/index\.json/);
  assert.match(storybookRunner, /--no-cache/);
  assert.match(storybookRunner, /playwright/);
  assert.match(storybookRunner, /'playwright', 'install', 'chromium'/);
  assert.match(storybookRunner, /STORYBOOK_INTERACTIONS_OK/);
  assert.match(setup, /127\.0\.0\.1:\$\{storybookPort\}/);
  assert.match(setup, /normalizeGeneratedStorybookConfig/);
  assert.match(setup, /normalizeGeneratedStorybookWhitespace/);
  assert.match(setup, /storybookTsconfig/);
  assert.match(setup, /replace\(\/\[ \\t\]\+\$\/gm, ''\)/);
  assert.match(setup, /fileURLToPath/);
  assert.match(setup, /dirname/);

  assert.match(loginStory, /LoginModalComponent/);
  assert.match(loginStory, /ValidLoginDispatchesRealAuthAction/);
  assert.match(loginStory, /AuthActions\.login/);
  assert.match(loginStory, /PasswordValidation/);
  assert.match(loginStory, /applicationConfig/);
  assert.match(loginStory, /provideNoopAnimations/);

  assert.match(musicStory, /MusicGenerationPageComponent/);
  assert.match(musicStory, /GenerateMusicDispatchesPersistentJob/);
  assert.match(musicStory, /DiffSingerScoreDispatchesPersistentJob/);
  assert.match(musicStory, /diffsinger-acoustic-hifigan/);
  assert.match(musicStory, /notesDuration/);
  assert.match(musicStory, /JobsActions\.createJob/);
  assert.match(musicStory, /CompletedGenerationShowsAudioPlayer/);
  assert.match(musicStory, /applicationConfig/);
  assert.match(musicStory, /provideNoopAnimations/);
  assert.match(musicModule, /exports: \[MusicGenerationPageComponent\]/);
  assert.match(musicStory, /\/downloads\/jobs\/storybook-musicgen-job\/music\.wav/);

  const testRunnerJest = read(
    'apps/frontend/.storybook/test-runner-jest.config.js'
  );
  assert.match(testRunnerJest, /getJestConfig/);
  assert.match(testRunnerJest, /<rootDir>\/dist\//);
  assert.match(testRunnerJest, /<rootDir>\/\.nx\/cache\//);
});


test('music generation UI switches to score-native DiffSinger inputs', () => {
  const component = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.ts'
  );
  const template = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.html'
  );
  const state = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.state.ts'
  );

  assert.match(component, /isDiffSingerSelected/);
  assert.match(component, /diffsingerNotes/);
  assert.match(component, /diffsingerNotesDuration/);
  assert.match(component, /hasRequiredGenerationInputs/);
  assert.match(component, /lyrics: this\.lyrics\.trim\(\)/);
  assert.match(component, /notesDuration: this\.diffsingerNotesDuration\.trim\(\)/);
  assert.match(component, /inputType: 'word'/);
  assert.match(template, /DiffSinger Score/);
  assert.match(template, /DiffSinger lyrics or score text/);
  assert.match(template, /DiffSinger notes/);
  assert.match(template, /DiffSinger note durations/);
  assert.match(template, /isDiffSingerSelected; else musicGenParameters/);
  assert.match(state, /runtimeModelId\?: string/);
});

test('backend MusicGen execution targets the isolated provider container', () => {
  const service = read('apps/backend/src/songs/stem-export.service.ts');
  assert.match(service, /harmonia-musicgen/);
  assert.doesNotMatch(service, /harmonia-worker/);
  assert.doesNotMatch(service, /harmonia-dev/);
});


test('Stable Audio 3 Small-Music provider is isolated and qualification verifies native stereo float output', () => {
  const dockerfile = read('Dockerfile.stable-audio-3');
  const entrypoint = read('entrypoint.stable-audio-3.sh');
  const server = read('scripts/stable_audio_3_provider_server.py');
  const client = read('scripts/stable_audio_3_provider_client.py');
  const qualifier = read('scripts/qualify-stable-audio-3-small-music.cjs');
  const compose = read('docker-compose.yml');
  const gpuCompose = read('docker-compose.gpu.yml');
  const catalog = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.scripts['qualify:stable-audio-3-small-music'],
    'node scripts/qualify-stable-audio-3-small-music.cjs'
  );
  assert.match(
    dockerfile,
    /779434a908193105335fd8d833418603625b2859/
  );
  assert.match(dockerfile, /torch==2\.7\.1/);
  assert.match(dockerfile, /torchaudio==2\.7\.1/);
  assert.match(dockerfile, /cu126/);
  assert.match(entrypoint, /HF_TOKEN/);
  assert.match(entrypoint, /HUGGINGFACE_API_KEY/);
  assert.match(entrypoint, /HUGGING_FACE_HUB_TOKEN/);
  assert.match(entrypoint, /HUGGINGFACE_HUB_TOKEN/);
  assert.match(server, /StableAudioModel\.from_pretrained/);
  assert.match(server, /small-music/);
  assert.match(server, /subtype="FLOAT"/);
  assert.match(client, /127\.0\.0\.1:8766\/generate/);
  assert.match(compose, /harmonia-stable-audio-3/);
  assert.match(compose, /HF_TOKEN: \${HF_TOKEN:-}/);
  assert.match(compose, /HUGGINGFACE_API_KEY: \${HUGGINGFACE_API_KEY:-}/);
  assert.match(compose, /HUGGING_FACE_HUB_TOKEN: \${HUGGING_FACE_HUB_TOKEN:-}/);
  assert.match(compose, /HUGGINGFACE_HUB_TOKEN: \${HUGGINGFACE_HUB_TOKEN:-}/);
  assert.match(compose, /model-stable-audio-3/);
  assert.match(
    compose,
    /\.\/models\/stable-audio-3:\/workspace\/models\/stable-audio-3/
  );
  assert.match(gpuCompose, /stable-audio-3:/);
  assert.match(
    catalog,
    /id: 'stable-audio-3-small-music'[\s\S]*runtimeModelId: 'small-music'[\s\S]*availability: 'installed'/
  );
  assert.match(qualifier, /HF_TOKEN/);
  assert.match(qualifier, /HUGGINGFACE_API_KEY/);
  assert.match(qualifier, /HUGGING_FACE_HUB_TOKEN/);
  assert.match(qualifier, /HUGGINGFACE_HUB_TOKEN/);
  assert.match(qualifier, /wav\.channels !== 2/);
  assert.match(qualifier, /wav\.sampleRate !== 44100/);
  assert.match(qualifier, /wav\.bitsPerSample !== 32/);
  assert.match(
    qualifier,
    /STABLE_AUDIO_3_SMALL_MUSIC_QUALIFICATION_OK/
  );
});

test('DiffSinger real inference qualification rejects placeholder audio', () => {
  const qualifier = read('scripts/qualify-diffsinger-inference.cjs');
  const wrapper = read('scripts/run_diffsinger.py');
  const helper = read('scripts/diffsinger_infer_helper.py');
  const vocalPhase = read('generate_script/phase_vocals.js');
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.scripts['qualify:diffsinger-inference'],
    'node scripts/qualify-diffsinger-inference.cjs'
  );
  assert.match(qualifier, /diffsinger_infer_helper\.py/);
  assert.match(qualifier, /model_ckpt_steps_\*\.ckpt/);
  assert.match(qualifier, /HARMONIA_DIFFSINGER_PLACEHOLDER/);
  assert.match(qualifier, /DIFFSINGER_INFERENCE_QUALIFICATION_OK/);
  assert.match(helper, /017bd488a61ebdb8909a8d272ec6211076fa4a7e/);
  assert.match(helper, /0228_opencpop_ds100_rel/);
  assert.match(helper, /0102_xiaoma_pe/);
  assert.match(helper, /0109_hifigan_bigpopcs_hop128/);
  assert.match(helper, /DiffSingerE2EInfer\.example_run/);
  assert.doesNotMatch(helper, /CategorizedModule|_loose_load_ckpt/);
  assert.doesNotMatch(wrapper, /write_placeholder_wav/);
  assert.doesNotMatch(wrapper, /placeholder written/);
  assert.match(wrapper, /is_valid_wav/);
  assert.match(vocalPhase, /isValidWav/);
  assert.match(vocalPhase, /throw new Error/);
  assert.doesNotMatch(
    vocalPhase,
    /DiffSinger failed; placeholder/
  );
});

test('Stable Audio 3 persistent jobs use the resident provider and preserve native float WAV output', () => {
  const jobs = read('apps/backend/src/jobs/jobs.service.ts');
  const qualifier = read('scripts/qualify-stable-audio-3-job.cjs');
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.scripts['qualify:stable-audio-3-job'],
    'node scripts/qualify-stable-audio-3-job.cjs'
  );
  assert.match(
    jobs,
    /'musicgen'[\s\S]*'diffsinger'[\s\S]*'stable-audio-3'[\s\S]*'ace-step-1\.5'/
  );
  assert.match(jobs, /runStableAudio3Client/);
  assert.match(jobs, /harmonia-stable-audio-3/);
  assert.match(jobs, /stable_audio_3_provider_client\.py/);
  assert.match(jobs, /model\.providerId === 'stable-audio-3'/);
  assert.match(qualifier, /stable-audio-3-small-music/);
  assert.match(qualifier, /runtimeModelId = 'small-music'/);
  assert.match(qualifier, /wav\.channels !== 2/);
  assert.match(qualifier, /wav\.sampleRate !== 44100/);
  assert.match(qualifier, /wav\.bitsPerSample !== 32/);
  assert.match(qualifier, /wav\.audioFormat !== 3/);
  assert.match(qualifier, /backend download/);
  assert.match(qualifier, /frontend download/);
  assert.match(qualifier, /STABLE_AUDIO_3_JOB_QUALIFICATION_OK/);
});

test('DiffSinger persistent jobs execute score-native synthesis', () => {
  const jobs = read('apps/backend/src/jobs/jobs.service.ts');
  const catalog = read('apps/backend/src/music-runtime/music-model.catalog.ts');
  const compose = read('docker-compose.yml');
  const helper = read('scripts/diffsinger_infer_helper.py');
  const wrapper = read('scripts/run_diffsinger.py');
  const qualifier = read('scripts/qualify-diffsinger-job.cjs');
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.scripts['qualify:diffsinger-job'],
    'node scripts/qualify-diffsinger-job.cjs'
  );
  assert.match(
    catalog,
    /runtimeModelId:\s*'0228_opencpop_ds100_rel'/
  );
  assert.match(
    jobs,
    /\[[^\]]*'diffsinger'[^\]]*\]\.includes\(model\.providerId\)/
  );
  assert.match(jobs, /parseDiffSingerScore/);
  assert.match(jobs, /runDiffSingerClient/);
  assert.match(jobs, /request\.json/);
  assert.match(jobs, /harmonia-diffsinger/);
  assert.match(jobs, /\/workspace\/scripts\/run_diffsinger\.py/);
  assert.match(jobs, /notesDuration/);
  assert.match(jobs, /expectedDurationSeconds/);
  assert.match(compose, /\.\/exports:\/workspace\/exports/);
  assert.match(helper, /score_json/);
  assert.match(helper, /provided\.get\("notes_duration"\)/);
  assert.match(wrapper, /meta_path/);
  assert.match(qualifier, /diffsinger-acoustic-hifigan/);
  assert.match(qualifier, /0228_opencpop_ds100_rel/);
  assert.match(qualifier, /request\.json/);
  assert.match(qualifier, /DIFFSINGER_JOB_QUALIFICATION_OK/);
});

test('DiffSinger runtime qualification requires a healthy isolated container', () => {
  const qualifier = read('scripts/qualify-diffsinger-runtime.cjs');
  const pkg = JSON.parse(read('package.json'));

  assert.equal(
    pkg.scripts['qualify:diffsinger-runtime'],
    'node scripts/qualify-diffsinger-runtime.cjs'
  );
  assert.match(qualifier, /diffsinger-acoustic-hifigan/);
  assert.match(qualifier, /harmonia-diffsinger/);
  assert.match(qualifier, /state\.Health\?\.Status !== 'healthy'/);
  assert.match(qualifier, /harmonia-runtime-ready/);
  assert.match(qualifier, /DIFFSINGER_RUNTIME_QUALIFICATION_OK/);
});

test('DiffSinger is isolated from the generic worker image', () => {
  const worker = read('Dockerfile.worker');
  const diffsinger = read('Dockerfile.diffsinger');
  const compose = read('docker-compose.yml');

  assert.doesNotMatch(worker, /\/opt\/DiffSinger|HiFi-GAN|openvpi\/DiffSinger/);
  assert.match(diffsinger, /openvpi\/DiffSinger/);
  assert.match(diffsinger, /017bd488a61ebdb8909a8d272ec6211076fa4a7e/);
  assert.match(diffsinger, /python3\.8/);
  assert.match(diffsinger, /torch==1\.8\.2/);
  assert.doesNotMatch(diffsinger, /git clone --depth=1/);
  assert.match(diffsinger, /git checkout --detach/);
  assert.match(diffsinger, /entrypoint\.diffsinger\.sh/);
  assert.match(compose, /profiles:\s*\n\s*- model-diffsinger/);
  assert.match(
    compose,
    /\.\/models\/diffsinger:\/workspace\/models\/diffsinger/
  );
});

test('DiffSinger pretrained inference stack is cached outside the provider image', () => {
  const dockerfile = read('Dockerfile.diffsinger');
  const entrypoint = read('entrypoint.diffsinger.sh');
  const downloader = read('scripts/download_diffsinger_pretrained.sh');
  const compose = read('docker-compose.yml');

  assert.doesNotMatch(dockerfile, /0228_opencpop_ds100_rel\.zip/);
  assert.doesNotMatch(dockerfile, /0102_xiaoma_pe\.zip/);
  assert.doesNotMatch(dockerfile, /0109_hifigan_bigpopcs_hop128\.zip/);

  for (const source of [entrypoint, downloader]) {
    assert.match(source, /0228_opencpop_ds100_rel/);
    assert.match(source, /0102_xiaoma_pe/);
    assert.match(source, /0109_hifigan_bigpopcs_hop128/);
    assert.match(source, /--fail/);
  }

  assert.match(entrypoint, /Using cached DiffSinger acoustic model/);
  assert.match(entrypoint, /Using cached DiffSinger pitch estimator/);
  assert.match(entrypoint, /Using cached DiffSinger vocoder/);
  assert.match(entrypoint, /find -L "\$\{dir\}"/);
  assert.match(entrypoint, /find -L "\/opt\/DiffSinger\/checkpoints/);
  assert.match(entrypoint, /harmonia-runtime-ready/);
  assert.match(compose, /torch\.__version__\.startswith\(\\?"1\.8\.2\\?"\)/);
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
test('ACE-Step 1.5 provider image is pinned isolated and boot-safe without model downloads', () => {
  const worker = read('Dockerfile.worker');
  const ace = read('Dockerfile.ace-step-1.5');
  const compose = read('docker-compose.yml');
  const gpu = read('docker-compose.gpu.yml');
  const catalog = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );

  assert.doesNotMatch(worker, /ACE-Step|acestep/i);
  assert.match(
    ace,
    /ARG ACESTEP_REF=ca1e85fe9430179831e6bc6be790c332190a3866/
  );
  assert.match(
    ace,
    /git checkout --detach "\$\{ACESTEP_REF\}"/
  );
  assert.match(
    ace,
    /uv sync --frozen --no-dev --python python3\.11/
  );
  assert.match(
    ace,
    /ENV ACESTEP_NO_INIT=true/
  );
  assert.match(
    ace,
    /ENV ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0\.6B/
  );
  assert.match(
    ace,
    /ENV ACESTEP_OFFLOAD_DIT_TO_CPU=true/
  );
  assert.match(
    ace,
    /ENV HF_HUB_OFFLINE=1/
  );
  assert.match(
    ace,
    /ENV TRANSFORMERS_OFFLINE=1/
  );
  assert.match(
    ace,
    /acestep-api", "--host", "0\.0\.0\.0", "--port", "8001"/
  );

  assert.match(
    compose,
    /ace-step-1\.5:[\s\S]*profiles:[\s\S]*- model-ace-step-1\.5/
  );
  assert.match(
    compose,
    /harmonia\/ace-step-1\.5:dev/
  );
  assert.match(
    compose,
    /\.\/models\/ace-step-1\.5:\/workspace\/models\/ace-step-1\.5/
  );
  assert.match(
    compose,
    /\.\/models\/ace-step-1\.5\/checkpoints:\/opt\/ACE-Step-1\.5\/checkpoints/
  );
  assert.match(
    compose,
    /ACESTEP_OFFLOAD_DIT_TO_CPU: "true"/
  );
  assert.match(
    compose,
    /ACESTEP_NO_INIT: "true"/
  );
  assert.match(
    compose,
    /HF_HUB_OFFLINE: "1"/
  );
  assert.match(
    compose,
    /127\.0\.0\.1:8001\/health/
  );
  const aceCompose =
    compose.match(
      /  ace-step-1\.5:[\s\S]*?(?=\r?\n  stable-audio-3:)/
    )?.[0] || '';

  assert.ok(
    aceCompose,
    'ACE-Step Compose service block is missing'
  );

  assert.doesNotMatch(
    aceCompose,
    /^\s+ports:/m
  );

  assert.match(
    gpu,
    /ace-step-1\.5:[\s\S]*runtime: nvidia/
  );

  assert.match(
    catalog,
    /id: 'ace-step-1\.5'[\s\S]*runtimeInstalled: true[\s\S]*imageName: 'harmonia\/ace-step-1\.5:dev'/
  );
  assert.match(
    catalog,
    /id: 'acestep-v15-turbo-06b'[\s\S]*runtimeModelId: 'acestep-v15-turbo'[\s\S]*availability: 'installed'/
  );
});

test('ACE-Step runtime selection initializes Turbo and 0.6B LM before ready and recovers resident state', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(
    backend,
    /provider\.id === 'ace-step-1\.5'[\s\S]*'loading-model'[\s\S]*prepareProviderModel/
  );
  assert.match(
    backend,
    /http:\/\/127\.0\.0\.1:8001\/v1\/init/
  );
  assert.match(
    backend,
    /init_llm: true/
  );
  assert.match(
    backend,
    /lm_model_path:[\s\S]*'acestep-5Hz-lm-0\.6B'/
  );
  assert.match(
    backend,
    /loaded_model[^\n]*!== model\.runtimeModelId/
  );
  assert.match(
    backend,
    /loaded_lm_model[^\n]*!== 'acestep-5Hz-lm-0\.6B'/
  );
  assert.match(
    backend,
    /provider\.id === 'ace-step-1\.5'[\s\S]*\? 8001/
  );
  assert.match(
    backend,
    /parsed\.data\?\.models_initialized[\s\S]*parsed\.data\?\.llm_initialized[\s\S]*loaded_lm_model === 'acestep-5Hz-lm-0\.6B'/
  );
  assert.match(
    backend,
    /Turbo and the 0\.6B LM are resident/
  );
});

test('ACE-Step durable generation submits supplied lyrics through async API and downloads WAV', () => {
  const client = read(
    'scripts/ace_step_provider_client.py'
  );
  const jobs = read(
    'apps/backend/src/jobs/jobs.service.ts'
  );
  const component = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.ts'
  );
  const compose = read(
    'docker-compose.yml'
  );

  assert.match(
    jobs,
    /'ace-step-1\.5'/
  );
  assert.match(
    jobs,
    /runAceStepClient/
  );
  assert.match(
    jobs,
    /ACE-Step generation requires supplied lyrics/
  );
  assert.match(
    jobs,
    /minimumDuration[\s\S]*model\.providerId === 'ace-step-1\.5'[\s\S]*\? 10/
  );
  assert.match(
    jobs,
    /ace_step_provider_client\.py/
  );
  assert.match(
    jobs,
    /aceStep: ace/
  );

  assert.match(
    component,
    /lyrics: this\.lyrics\.trim\(\)/
  );
  assert.match(
    component,
    /get isAceStepSelected\(\)/
  );
  assert.match(
    component,
    /ACE-Step requires supplied lyrics for this qualified full-song workflow/
  );

  assert.match(
    compose,
    /\.\/scripts:\/workspace\/scripts:ro/
  );

  assert.match(
    client,
    /\/release_task/
  );
  assert.match(
    client,
    /\/query_result/
  );
  assert.match(
    client,
    /generated\.get\("file"\)[\s\S]*generated\.get\("url"\)[\s\S]*generated\.get\("first_audio_path"\)/
  );
  assert.match(
    client,
    /download_audio\(str\(audio_url\), output_path\)/
  );
  assert.match(
    client,
    /"thinking": True/
  );
  assert.match(
    client,
    /"audio_format": "wav"/
  );
  assert.match(
    client,
    /"batch_size": 1/
  );
  assert.match(
    client,
    /"lm_model_path": "acestep-5Hz-lm-0\.6B"/
  );
  assert.match(
    client,
    /"use_cot_caption": False/
  );
  assert.match(
    client,
    /"use_cot_language": False/
  );
  assert.match(
    client,
    /generated\.get\("lyrics", payload\["lyrics"\]\)/
  );
});

test('ACE-Step persistent job qualifier proves lyrics models and downloads', () => {
  const qualifier = read(
    'scripts/qualify-ace-step-job.cjs'
  );
  const pkg = JSON.parse(
    read('package.json')
  );

  assert.equal(
    pkg.scripts['qualify:ace-step-job'],
    'node scripts/qualify-ace-step-job.cjs'
  );
  assert.match(
    qualifier,
    /acestep-v15-turbo-06b/
  );
  assert.match(
    qualifier,
    /acestep-v15-turbo/
  );
  assert.match(
    qualifier,
    /acestep-5Hz-lm-0\.6B/
  );
  assert.match(
    qualifier,
    /requestedDuration = 30/
  );
  assert.match(
    qualifier,
    /HARMONIA_QUALIFY_BACKEND_BASE/
  );
  assert.match(
    qualifier,
    /HARMONIA_QUALIFY_FRONTEND_BASE/
  );
  assert.match(
    qualifier,
    /lyricsPreserved/
  );
  assert.match(
    qualifier,
    /backend download/
  );
  assert.match(
    qualifier,
    /frontend download/
  );
  assert.match(
    qualifier,
    /ACE_STEP_JOB_QUALIFICATION_OK/
  );
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
  assert.match(
    backend,
    /provider\.id === 'musicgen'[\s\S]*\? 8765/
  );
  assert.match(
    backend,
    /127\.0\.0\.1:\$\{healthPort\}\/health/
  );
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


test('qualified generator showcase exposes one preset per qualified model', () => {
  const pkg = JSON.parse(read('package.json'));
  const runner = read('scripts/generate-qualified-showcase.cjs');

  assert.equal(
    pkg.scripts['showcase:qualified-generators'],
    'node scripts/generate-qualified-showcase.cjs'
  );

  for (const modelId of [
    'musicgen-small',
    'musicgen-stereo-small',
    'diffsinger-acoustic-hifigan',
    'stable-audio-3-small-music',
    'acestep-v15-turbo-06b',
  ]) {
    const preset = JSON.parse(
      read('showcase/qualified-generators/' + modelId + '/preset.json')
    );

    assert.equal(preset.modelId, modelId);
    assert.ok(preset.slug);
    assert.ok(preset.title);
    assert.ok(preset.parameters);
    assert.equal(runner.includes(modelId), true);
  }

  assert.match(runner, /path\.join\(root, 'exports', 'showcase'\)/);
  assert.match(runner, /QUALIFIED_GENERATOR_SHOWCASE_OK/);
  assert.match(runner, /SHOWCASE_DATE/);
  assert.match(runner, /SHOWCASE_ONLY/);
});


test('qualified showcase fresh runner owns an isolated backend', () => {
  const runner = read('scripts/run-qualified-showcase.sh');

  assert.match(runner, /PORT=3114/);
  assert.match(runner, /HARMONIA_SHOWCASE_BACKEND_BASE/);
  assert.match(runner, /backend-3114\.log/);
  assert.match(runner, /SHOWCASE_FRESH_BACKEND_READY/);
  assert.match(runner, /SHOWCASE FAILURE DIAGNOSTICS/);
  assert.match(runner, /QUALIFIED GENERATOR SHOWCASE: GREEN/);
  assert.match(runner, /QUALIFIED_GENERATOR_SHOWCASE_MANIFEST_5_OF_5_OK/);
});


test('showcase resumes dated samples and excludes runtime data from Docker contexts', () => {
  const runner = read('scripts/generate-qualified-showcase.cjs');
  const dockerignore = read('.dockerignore');

  assert.match(runner, /async function requestLong/);
  assert.match(
    runner,
    /const selected = await requestLong/
  );
  assert.match(runner, /SHOWCASE_REUSE/);
  assert.match(runner, /reusedExisting: true/);

  for (const ignored of [
    'models',
    'exports',
    'artifacts',
    'generated',
    'backups',
  ]) {
    assert.equal(
      dockerignore
        .split(/\r?\n/)
        .map((line) => line.trim())
        .includes(ignored),
      true,
      `Expected .dockerignore to exclude ${ignored}`
    );
  }
});

/*
 * PHASE 13A ASYNC RUNTIME SELECTION CONTRACT
 *
 * Runtime selection may perform Docker image reconciliation, container startup,
 * health checks, and provider-native model initialization. Those operations must
 * not hold the POST /music/runtime/select HTTP request open.
 *
 * The HTTP request acknowledges acceptance. Existing music-runtime:status
 * Socket.IO events remain authoritative for the actual provider lifecycle.
 */
test('async runtime selection acknowledges immediately and completes through runtime events', () => {
  const controller = read(
    'apps/backend/src/music-runtime/music-runtime.controller.ts'
  );
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );
  const backendTypes = read(
    'apps/backend/src/music-runtime/music-runtime.types.ts'
  );

  const frontendService = read(
    'apps/frontend/src/app/services/music-runtime.service.ts'
  );
  const frontendState = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.state.ts'
  );
  const frontendActions = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.actions.ts'
  );
  const frontendEffects = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.effects.ts'
  );
  const frontendReducer = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.reducer.ts'
  );
  const websocket = read(
    'apps/frontend/src/app/services/websocket.service.ts'
  );
  const gateway = read(
    'apps/backend/src/music-runtime/music-runtime.gateway.ts'
  );

  // HTTP acceptance is explicit: provider startup is not the HTTP response.
  assert.match(
    controller,
    /HttpCode/
  );
  assert.match(
    controller,
    /HttpStatus/
  );
  assert.match(
    controller,
    /@Post\('select'\)[\s\S]*@HttpCode\(HttpStatus\.ACCEPTED\)/
  );
  assert.match(
    controller,
    /requestModelSelection\(body\.modelId\)/
  );
  assert.doesNotMatch(
    controller,
    /return this\.runtime\.selectModel\(body\.modelId\)/
  );

  // Accepted response is a small operation acknowledgement, not final status.
  assert.match(
    backendTypes,
    /interface MusicRuntimeSelectionAccepted/
  );
  assert.match(
    backendTypes,
    /operationId:\s*string/
  );
  assert.match(
    backendTypes,
    /modelId:\s*string/
  );
  assert.match(
    backendTypes,
    /acceptedAt:\s*string/
  );
  assert.match(
    backendTypes,
    /state:\s*'accepted'/
  );

  // Backend creates a unique operation and schedules the existing long-running
  // selection lifecycle after returning the acknowledgement.
  assert.match(
    backend,
    /randomUUID/
  );
  assert.match(
    backend,
    /requestModelSelection\s*\(/
  );
  assert.match(
    backend,
    /MusicRuntimeSelectionAccepted/
  );
  assert.match(
    backend,
    /setImmediate\s*\(/
  );
  assert.match(
    backend,
    /void this\.selectModel\(\s*modelId,\s*operationId\s*\)/
  );
  assert.match(
    backend,
    /\.catch\s*\(/
  );

  // Existing provider lifecycle remains event-driven.
  for (const state of [
    'building',
    'starting',
    'health-checking',
    'healthy',
    'loading-model',
    'ready',
    'error',
  ]) {
    assert.match(
      backend,
      new RegExp(`'${state}'`)
    );
  }

  assert.match(
    gateway,
    /music-runtime:status/
  );
  assert.match(
    websocket,
    /music-runtime:status/
  );
  assert.match(
    websocket,
    /runtimeStatusReceived/
  );

  // Frontend POST consumes an acceptance object rather than pretending the
  // selected runtime is already ready.
  assert.match(
    frontendState,
    /interface MusicRuntimeSelectionAccepted/
  );
  assert.match(
    frontendService,
    /Observable<MusicRuntimeSelectionAccepted>/
  );
  assert.match(
    frontendActions,
    /selectModelAccepted/
  );

  assert.match(
    frontendEffects,
    /selectModelAccepted/
  );
  assert.doesNotMatch(
    frontendEffects,
    /selectModelSuccess\(\{\s*status\s*\}\)/
  );

  // Selection remains "switching" after HTTP acceptance. Runtime socket events
  // clear it only at a terminal runtime state.
  assert.match(
    frontendReducer,
    /selectModelAccepted/
  );
  assert.match(
    frontendReducer,
    /runtimeStatusReceived/
  );
  assert.match(
    frontendReducer,
    /\['ready', 'stopped', 'error'\]/
  );
});

/*
 * PHASE 14A RUNTIME OPERATION CORRELATION CONTRACT
 *
 * Phase 13 decoupled HTTP acknowledgement from long-running provider startup.
 * Phase 14 gives that accepted operation an identity for its entire lifecycle.
 *
 * A client-requested model selection receives one operationId. Every runtime
 * lifecycle event caused by that selection carries that same id until the
 * selection reaches ready or error.
 *
 * A correlated "stopped" state is not terminal: switching providers can stop
 * the previous provider before building/starting the requested provider.
 *
 * State recovered independently from Docker/backend restart is intentionally
 * uncorrelated and therefore carries operationId=null.
 */
test('runtime selection operation id correlates lifecycle events end to end', () => {
  const backend = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  const backendTypes = read(
    'apps/backend/src/music-runtime/music-runtime.types.ts'
  );

  const frontendState = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.state.ts'
  );

  const frontendReducer = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.reducer.ts'
  );

  const frontendSelectors = read(
    'apps/frontend/src/app/store/music-runtime/music-runtime.selectors.ts'
  );

  /*
   * Runtime status itself carries correlation.
   */
  assert.match(
    backendTypes,
    /interface MusicRuntimeStatus[\s\S]*operationId:\s*string\s*\|\s*null/
  );

  assert.match(
    frontendState,
    /interface MusicRuntimeStatus[\s\S]*operationId:\s*string\s*\|\s*null/
  );

  /*
   * Idle / recovered runtime snapshots are explicitly uncorrelated.
   */
  assert.match(
    backend,
    /private status:\s*MusicRuntimeStatus\s*=\s*\{[\s\S]*operationId:\s*null/
  );

  /*
   * requestModelSelection owns the UUID and passes that exact operation
   * identity into the asynchronous selection lifecycle.
   */
  assert.match(
    backend,
    /void this\.selectModel\(\s*modelId,\s*operationId\s*\)/
  );

  assert.match(
    backend,
    /async selectModel\([\s\S]*operationId:\s*string\s*\|\s*null\s*=\s*null/
  );

  /*
   * Transition construction must place the correlation id on emitted status.
   */
  assert.match(
    backend,
    /private async transition\([\s\S]*operationId:\s*string\s*\|\s*null\s*=\s*null/
  );

  assert.match(
    backend,
    /this\.status\s*=\s*\{[\s\S]*operationId,[\s\S]*updatedAt/
  );

  /*
   * Frontend state remembers the operation accepted by HTTP.
   */
  assert.match(
    frontendState,
    /activeSelectionOperationId:\s*string\s*\|\s*null/
  );

  /*
   * HTTP acceptance stores its operation id unless a correlated terminal
   * Socket.IO event already completed the selection before the HTTP response
   * reached NgRx.
   */
  assert.match(
    frontendReducer,
    /selectModelAccepted[\s\S]*terminalAlreadyReceived[\s\S]*acceptance\.operationId/
  );

  assert.match(
    frontendReducer,
    /activeSelectionOperationId:[\s\S]*terminalAlreadyReceived[\s\S]*\?\s*null[\s\S]*:\s*acceptance\.operationId/
  );

  /*
   * Socket events are correlation-aware.
   */
  assert.match(
    frontendReducer,
    /status\.operationId/
  );

  assert.match(
    frontendReducer,
    /activeSelectionOperationId/
  );

  /*
   * Correlated ready/error are terminal for model selection.
   * Correlated stopped is explicitly allowed as an intermediate state while
   * replacing one provider with another.
   */
  assert.match(
    frontendReducer,
    /['"]ready['"]/
  );

  assert.match(
    frontendReducer,
    /['"]error['"]/
  );

  assert.doesNotMatch(
    frontendReducer,
    /\[['"]ready['"],\s*['"]stopped['"],\s*['"]error['"]\]\.includes\(status\.state\)/
  );

  /*
   * Operation correlation is observable for diagnostics/UI.
   */
  assert.match(
    frontendSelectors,
    /selectActiveRuntimeSelectionOperationId/
  );
});


test('security S1 authenticates job sockets and protects runtime mutation boundaries', () => {
  const jobsGateway = read(
    'apps/backend/src/app/gateways/jobs.gateway.ts'
  );
  const jobsModule = read(
    'apps/backend/src/jobs/jobs.module.ts'
  );

  const jobsService = read(
    'apps/backend/src/jobs/jobs.service.ts'
  );
  const authModule = read(
    'apps/backend/src/auth/auth.module.ts'
  );
  const songs = read(
    'apps/backend/src/songs/songs.controller.ts'
  );
  const runtime = read(
    'apps/backend/src/music-runtime/music-runtime.controller.ts'
  );
  const runtimeGateway = read(
    'apps/backend/src/music-runtime/music-runtime.gateway.ts'
  );

  // No placeholder identity may survive.
  assert.doesNotMatch(
    jobsGateway,
    /mock-user-id/
  );

  assert.doesNotMatch(
    jobsGateway,
    /TODO:\s*Validate JWT token/
  );

  // Socket authentication uses the configured Nest JWT provider and checks
  // that the token subject still resolves to an active user session.
  assert.match(
    jobsGateway,
    /JwtService/
  );

  assert.match(
    jobsGateway,
    /verifyAsync/
  );

  assert.match(
    jobsGateway,
    /UserDocument/
  );

  assert.match(
    jobsGateway,
    /userModel\.exists/
  );

  assert.match(
    jobsGateway,
    /client\.data\.userId/
  );

  // JobsService passes its typed DTO directly to the gateway rather than
  // escaping structural typing through a cast.
  assert.match(
    jobsService,
    /emitJobCompleted\(dto\)/
  );

  assert.doesNotMatch(
    jobsService,
    /emitJobCompleted\(dto\s+as/
  );

  // Per-job rooms require both job id and authenticated owner id.
  assert.match(
    jobsGateway,
    /jobModel\.exists/
  );

  assert.match(
    jobsGateway,
    /userId:\s*new Types\.ObjectId\(\s*userId\s*\)/
  );

  // S1 TypeScript may not use explicit escape-hatch types.
  for (const source of [
    jobsGateway,
    read(
      'apps/backend/src/app/gateways/jobs.gateway.spec.ts'
    ),
    read(
      'apps/backend/src/jobs/jobs.module.ts'
    ),
    read(
      'apps/backend/src/songs/songs.controller.ts'
    ),
    read(
      'apps/backend/src/music-runtime/music-runtime.controller.ts'
    ),
    read(
      'apps/backend/src/music-runtime/music-runtime.controller.spec.ts'
    ),
    runtimeGateway,
    authModule,
  ]) {
    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])any([^A-Za-z0-9_]|$)/
    );

    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])unknown([^A-Za-z0-9_]|$)/
    );
  }

  // JWT configuration is shared with the jobs feature instead of recreated.
  assert.match(
    authModule,
    /exports:\s*\[\s*AuthService,\s*JwtModule,?\s*\]/
  );

  assert.match(
    jobsModule,
    /AuthModule/
  );

  // Socket origins match the HTTP CORS boundary; wildcard credentialed
  // WebSockets are forbidden.
  for (const gateway of [jobsGateway, runtimeGateway]) {
    assert.match(
      gateway,
      /process\.env\.CORS_ORIGIN/
    );

    assert.doesNotMatch(
      gateway,
      /origin:\s*['"]\*['"]/
    );
  }

  // Song generation/analysis APIs are authenticated at the controller level.
  assert.match(
    songs,
    /@Controller\('songs'\)[\s\S]{0,180}@UseGuards\(JwtAuthGuard\)/
  );

  // Runtime reads remain observable, but mutations require JWT auth.
  assert.match(
    runtime,
    /@Post\('select'\)[\s\S]{0,180}@UseGuards\(JwtAuthGuard\)/
  );

  assert.match(
    runtime,
    /@Post\('stop'\)[\s\S]{0,180}@UseGuards\(JwtAuthGuard\)/
  );

  // An HTTP caller must not choose an arbitrary filesystem path for catalog
  // validation.
  assert.doesNotMatch(
    songs,
    /catalogPath/
  );

  assert.match(
    songs,
    /validateInstrumentCatalog\(\)[\s\S]{0,160}loadCatalog\(\)/
  );
});


test('security S2A separates access and refresh token trust boundaries', () => {
  const tokenConfig = read(
    'apps/backend/src/auth/auth-token.config.ts'
  );

  const authModule = read(
    'apps/backend/src/auth/auth.module.ts'
  );

  const authService = read(
    'apps/backend/src/auth/auth.service.ts'
  );

  const accessStrategy = read(
    'apps/backend/src/auth/strategies/jwt.strategy.ts'
  );

  const refreshStrategy = read(
    'apps/backend/src/auth/strategies/refresh-jwt.strategy.ts'
  );

  const refreshGuard = read(
    'apps/backend/src/auth/guards/refresh-jwt-auth.guard.ts'
  );

  const controller = read(
    'apps/backend/src/auth/auth.controller.ts'
  );

  const frontend = read(
    'apps/frontend/src/app/services/auth.service.ts'
  );

  const env = read(
    '.env.example'
  );

  assert.doesNotMatch(
    authModule,
    /default-secret-change-in-production/
  );

  assert.doesNotMatch(
    accessStrategy,
    /default-secret-change-in-production/
  );

  assert.match(
    tokenConfig,
    /must be different/
  );

  assert.match(
    env,
    /^JWT_REFRESH_SECRET=/m
  );

  assert.match(
    authService,
    /typ:\s*'access'/
  );

  assert.match(
    authService,
    /typ:\s*'refresh'/
  );

  assert.match(
    accessStrategy,
    /payload\.typ\s*!==\s*'access'/
  );

  assert.match(
    refreshStrategy,
    /payload\.typ\s*!==\s*'refresh'/
  );

  assert.match(
    refreshStrategy,
    /JWT_REFRESH_SECRET/
  );

  assert.match(
    refreshGuard,
    /jwt-refresh/
  );

  assert.match(
    controller,
    /RefreshJwtAuthGuard/
  );

  assert.match(
    controller,
    /Throttle/
  );

  assert.match(
    frontend,
    /Bearer \$\{refreshToken\}/
  );

  assert.doesNotMatch(
    frontend,
    /Bearer \$\{[^}]*access/
  );

  for (const source of [
    tokenConfig,
    authModule,
    authService,
    accessStrategy,
    refreshStrategy,
    refreshGuard,
    controller,
    frontend,
    read(
      'apps/backend/src/auth/auth.service.spec.ts'
    ),
    read(
      'apps/frontend/src/app/services/auth.service.spec.ts'
    ),
  ]) {
    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])any([^A-Za-z0-9_]|$)/
    );

    assert.doesNotMatch(
      source,
      /(^|[^A-Za-z0-9_])unknown([^A-Za-z0-9_]|$)/
    );
  }
});
