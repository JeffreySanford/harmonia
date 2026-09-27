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


test('start:all auto-detects GPU and --nogpu forces CPU mode end to end', () => {
  const startup = read(
    'scripts/start-all.cjs'
  );

  const runtime = read(
    'apps/backend/src/music-runtime/music-runtime.service.ts'
  );

  assert.match(
    startup,
    /function detectHostGpu/
  );

  assert.match(
    startup,
    /--query-gpu=name,memory\.total/
  );

  assert.match(
    startup,
    /gpuMode:\s*'auto'/
  );

  assert.match(
    startup,
    /--nogpu/
  );

  assert.match(
    startup,
    /HARMONIA_GPU_ENABLED:[\s\S]*gpuEnabled\s*\?\s*'true'\s*:\s*'false'/
  );

  assert.match(
    runtime,
    /HARMONIA_GPU_ENABLED'\]\s*===\s*'false'[\s\S]*gpuAvailable:\s*false/
  );

  assert.match(
    runtime,
    /gpuPreference\s*!==\s*'false'[\s\S]*hardware\.gpuAvailable/
  );
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
  assert.match(proxy, /"\/api"/);
  assert.doesNotMatch(proxy, /"\/downloads"/);
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
    assert.match(workflow, /uses: pnpm\/action-setup@v5/);

    assert.doesNotMatch(workflow, /version:\s*10\.23\.0/);
  }

});


test('GitHub Actions use Node 24-compatible action majors', () => {
  const ci = read('.github/workflows/ci.yml');
  const mongoose = read('.github/workflows/test_mongoose.yml');
  const license = read('.github/workflows/license_check.yml');
  const smoke = read('.github/workflows/smoke.yml');
  const release = read('.github/workflows/release.yml');

  const required = [
    [ci, /actions\/checkout@v5/],
    [ci, /pnpm\/action-setup@v5/],
    [ci, /actions\/setup-node@v5/],
    [ci, /actions\/setup-python@v6/],
    [ci, /actions\/cache@v5/],
    [ci, /docker\/setup-qemu-action@v4/],
    [ci, /docker\/setup-buildx-action@v4/],
    [ci, /docker\/build-push-action@v7/],

    [mongoose, /actions\/checkout@v5/],
    [mongoose, /actions\/setup-node@v5/],
    [mongoose, /pnpm\/action-setup@v5/],

    [license, /actions\/checkout@v5/],
    [license, /actions\/setup-python@v6/],

    [smoke, /actions\/checkout@v5/],
    [smoke, /actions\/setup-python@v6/],
    [smoke, /actions\/upload-artifact@v6/],
    [smoke, /actions\/github-script@v8/],

    [release, /actions\/checkout@v5/],
    [release, /actions\/setup-python@v6/],
    [release, /actions\/github-script@v8/],
  ];

  for (const [workflow, pattern] of required) {
    assert.match(workflow, pattern);
  }

  const operationalWorkflows =
    walkFiles('.github/workflows')
      .map(read)
      .join('\n');

  const retiredActionMajors = [
    /actions\/checkout@v4/,
    /actions\/setup-node@v4/,
    /actions\/setup-python@v4/,
    /actions\/setup-python@v5/,
    /actions\/cache@v4/,
    /actions\/upload-artifact@v4/,
    /actions\/upload-artifact@v5/,
    /actions\/github-script@v7/,
    /pnpm\/action-setup@v4/,
    /docker\/setup-qemu-action@v3/,
    /docker\/setup-buildx-action@v3/,
    /docker\/build-push-action@v6/,
  ];

  for (const pattern of retiredActionMajors) {
    assert.doesNotMatch(
      operationalWorkflows,
      pattern
    );
  }

  assert.match(
    ci,
    /node-version:\s*"20\.19\.0"/
  );

  assert.match(
    mongoose,
    /package-manager-cache:\s*false/
  );
});


test('Linux CI pins Ubuntu 24 and qualifies Ubuntu 26 separately', () => {
  const ci = read('.github/workflows/ci.yml');
  const mongoose = read('.github/workflows/test_mongoose.yml');
  const license = read('.github/workflows/license_check.yml');
  const smoke = read('.github/workflows/smoke.yml');
  const release = read('.github/workflows/release.yml');

  const operational = [
    ci,
    mongoose,
    license,
    smoke,
    release,
  ];

  for (const workflow of operational) {
    assert.doesNotMatch(
      workflow,
      /ubuntu-latest/
    );

    assert.match(
      workflow,
      /ubuntu-24\.04/
    );
  }

  assert.match(
    ci,
    /os:\s*\[ubuntu-24\.04,\s*windows-latest\]/
  );

  const qualificationPath =
    '.github/workflows/ubuntu26_qualification.yml';

  assert.equal(
    existsSync(
      path.join(
        root,
        qualificationPath
      )
    ),
    true,
    'Ubuntu 26.04 qualification workflow must exist'
  );

  const qualification =
    read(qualificationPath);

  assert.doesNotMatch(
    qualification,
    /ubuntu-latest/
  );

  assert.match(
    qualification,
    /runs-on:\s*ubuntu-26\.04/
  );

  assert.match(
    qualification,
    /node-version:\s*"20\.19\.0"/
  );

  assert.match(
    qualification,
    /run:\s*pnpm test:all/
  );

  assert.match(
    qualification,
    /run:\s*pnpm typecheck/
  );

  assert.match(
    qualification,
    /run:\s*pnpm build:all/
  );

  assert.match(
    qualification,
    /run:\s*pnpm test:mongo/
  );
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
  assert.match(qualify, /\/api\/jobs\/\$\{jobId\}\/artifact/);
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
  assert.match(musicStory, /\/api\/jobs\/storybook-musicgen-job\/artifact/);
  assert.match(musicStory, /getArtifact/);
  assert.doesNotMatch(musicStory, /\/downloads\/jobs\//);

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

  const providerContainers = [
    'harmonia-diffsinger',
    'harmonia-diffsinger-openutau',
    'harmonia-musicgen',
    'harmonia-stable-audio-3',
    'harmonia-ace-step-1.5',
  ];

  for (const containerName of providerContainers) {
    const marker =
      'container_name: ' + containerName;

    const containerIndex =
      compose.indexOf(marker);

    assert.ok(
      containerIndex >= 0,
      containerName + ' must exist in docker-compose.yml'
    );

    const restartIndex =
      compose.indexOf(
        'restart: "no"',
        containerIndex
      );

    const nextContainerIndex =
      compose.indexOf(
        'container_name:',
        containerIndex + marker.length
      );

    assert.ok(
      restartIndex >= 0 &&
        (
          nextContainerIndex < 0 ||
          restartIndex < nextContainerIndex
        ),
      containerName +
        ' must remain orchestrator-owned with restart: "no"'
    );
  }

  assert.equal(
    providerContainers.length,
    5
  );

  assert.match(
    backend,
    /state\.Health\?\.Status === 'unhealthy'/
  );

  assert.match(
    backend,
    /became unhealthy/
  );
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
  assert.match(startup, /--gpu explicitly requires a supported GPU runtime/);

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
    'diffrhythm-v12-base',
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
  assert.match(runner, /QUALIFIED_GENERATOR_SHOWCASE_MANIFEST_6_OF_6_OK/);

});


test('showcase resumes dated samples and excludes runtime data from Docker contexts', () => {
  const runner = read('scripts/generate-qualified-showcase.cjs');
  const dockerignore = read('.dockerignore');

  assert.match(
    runner,
    /runtime-selection-client\.cjs/
  );

  assert.match(
    runner,
    /selectRuntimeModel\s*\(/
  );

  assert.doesNotMatch(
    runner,
    /async function requestLong/
  );

  assert.doesNotMatch(
    runner,
    /requestLong\s*\(/
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

  const refreshSessionService = read(
    'apps/backend/src/auth/refresh-session.service.ts'
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
    refreshSessionService,
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
    /refreshToken\(\)/
  );


  assert.doesNotMatch(
    frontend,
    /Bearer \$\{[^}]*access/
  );

  for (const source of [
    tokenConfig,
    authModule,
    authService,
    refreshSessionService,
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


test('security S2B-A uses hashed single-use HttpOnly refresh sessions', () => {
  const tokenConfig = read(
    'apps/backend/src/auth/auth-token.config.ts'
  );

  const sessionSchema = read(
    'apps/backend/src/schemas/refresh-session.schema.ts'
  );

  const refreshCookie = read(
    'apps/backend/src/auth/refresh-cookie.ts'
  );

  const sessionService = read(
    'apps/backend/src/auth/refresh-session.service.ts'
  );

  const sessionSpec = read(
    'apps/backend/src/auth/refresh-session.service.spec.ts'
  );

  const authService = read(
    'apps/backend/src/auth/auth.service.ts'
  );

  const authServiceSpec = read(
    'apps/backend/src/auth/auth.service.spec.ts'
  );

  const controller = read(
    'apps/backend/src/auth/auth.controller.ts'
  );

  const controllerSpec = read(
    'apps/backend/src/auth/auth.controller.spec.ts'
  );

  const refreshStrategy = read(
    'apps/backend/src/auth/strategies/refresh-jwt.strategy.ts'
  );

  assert.match(
    tokenConfig,
    /sid:\s*string/
  );

  assert.match(
    tokenConfig,
    /fid:\s*string/
  );

  assert.match(
    sessionSchema,
    /tokenHash/
  );


  assert.doesNotMatch(
    sessionSchema,
    /refreshToken/
  );

  assert.match(
    sessionSchema,
    /expireAfterSeconds:\s*0/
  );

  assert.match(
    sessionService,
    /createHash\(\s*'sha256'\s*\)/
  );

  assert.match(
    sessionService,
    /findOneAndUpdate/
  );

  assert.match(
    sessionService,
    /revokedAt:\s*null/
  );

  assert.match(
    sessionService,
    /revokeReason:\s*'rotated'/
  );

  assert.match(
    sessionService,
    /reuse-detected/
  );

  assert.match(
    sessionService,
    /rotation-write-failed/
  );

  assert.match(
    refreshCookie,
    /httpOnly:\s*true/
  );

  assert.match(
    refreshCookie,
    /sameSite:\s*'strict'/
  );

  assert.match(
    refreshCookie,
    /REFRESH_COOKIE_NAME/
  );

  assert.match(
    refreshStrategy,
    /extractRefreshCookieFromHeader/
  );


  assert.doesNotMatch(
    refreshStrategy,
    /fromAuthHeaderAsBearerToken/
  );

  assert.match(
    controller,
    /setRefreshCookie/
  );

  assert.match(
    controller,
    /requireRefreshCookie/
  );

  assert.match(
    controller,
    /clearRefreshCookie/
  );

  assert.match(
    controller,
    /return\s+session\.response/
  );

  assert.match(
    authService,
    /RefreshSessionService/
  );

  assert.match(
    authServiceSpec,
    /hasOwnProperty/
  );

  assert.match(
    controllerSpec,
    /httpOnly:\s*true/
  );

  assert.match(
    sessionSpec,
    /reuse-detected/
  );

  for (const source of [
    tokenConfig,
    sessionSchema,
    refreshCookie,
    sessionService,
    sessionSpec,
    authService,
    authServiceSpec,
    controller,
    controllerSpec,
    refreshStrategy,
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

test('security S2B-B keeps refresh credentials out of browser-readable state', () => {
  const service = read(
    'apps/frontend/src/app/services/auth.service.ts'
  );

  const state = read(
    'apps/frontend/src/app/store/auth/auth.state.ts'
  );

  const actions = read(
    'apps/frontend/src/app/store/auth/auth.actions.ts'
  );

  const reducer = read(
    'apps/frontend/src/app/store/auth/auth.reducer.ts'
  );

  const effects = read(
    'apps/frontend/src/app/store/auth/auth.effects.ts'
  );

  const serviceSpec = read(
    'apps/frontend/src/app/services/auth.service.spec.ts'
  );

  const reducerSpec = read(
    'apps/frontend/src/app/store/auth/auth.reducer.spec.ts'
  );

  const e2e = read(
    'tests/e2e/helpers/auth.ts'
  );

  // Refresh credentials are not modeled in browser-readable responses/state.

  assert.doesNotMatch(
    service,
    /refreshToken:\s*string/
  );


  assert.doesNotMatch(
    state,
    /refreshToken:\s*/
  );


  assert.doesNotMatch(
    actions,
    /refreshToken:\s*string/
  );


  assert.doesNotMatch(
    reducer,
    /(^|[^.A-Za-z0-9_])refreshToken\s*[,}:]/m
  );

  // Browser code may purge the old key, but may never read or write it.
  for (const source of [
    service,
    state,
    effects,
  ]) {

    assert.doesNotMatch(
      source,
      /getItem\(\s*['"]refresh_token['"]/
    );


    assert.doesNotMatch(
      source,
      /setItem\(\s*['"]refresh_token['"]/
    );
  }

  // Login/register establish the cookie, refresh/logout consume it.
  assert.match(
    service,
    /login\([\s\S]{0,700}withCredentials:\s*true/
  );

  assert.match(
    service,
    /register\([\s\S]{0,700}withCredentials:\s*true/
  );

  assert.match(
    service,
    /logout\(\)[\s\S]{0,700}withCredentials:\s*true/
  );

  assert.match(
    service,
    /refreshToken\(\)[\s\S]{0,700}withCredentials:\s*true/
  );

  // Refresh no longer uses a browser-managed bearer credential.

  assert.doesNotMatch(
    service,
    /HttpHeaders/
  );


  assert.doesNotMatch(
    service,
    /Bearer\s+\$\{refreshToken\}/
  );

  // E2E must prove the new browser contract instead of recreating the old one.

  assert.doesNotMatch(
    e2e,
    /refresh_token/
  );


  assert.doesNotMatch(
    e2e,
    /refreshToken\?:/
  );

  assert.match(
    serviceSpec,
    /HttpOnly refresh/
  );

  assert.match(
    reducerSpec,
    /replaces only the access token after refresh/
  );

  // New S2B frontend auth code keeps the concrete-type rule.
  for (const source of [
    service,
    state,
    actions,
    reducer,
    effects,
    serviceSpec,
    reducerSpec,
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

test('security S3-A makes generated and uploaded files private', () => {
  const appModule = read(
    'apps/backend/src/app/app.module.ts'
  );

  const libraryController = read(
    'apps/backend/src/library/library.controller.ts'
  );

  const libraryService = read(
    'apps/backend/src/library/library.service.ts'
  );

  const jobsController = read(
    'apps/backend/src/jobs/jobs.controller.ts'
  );

  const jobsService = read(
    'apps/backend/src/jobs/jobs.service.ts'
  );

  // Private artifacts must never be exposed as anonymous static trees.

  assert.doesNotMatch(
    appModule,
    /ServeStaticModule/
  );


  assert.doesNotMatch(
    appModule,
    /serveRoot:\s*['"]\/uploads['"]/
  );


  assert.doesNotMatch(
    appModule,
    /serveRoot:\s*['"]\/downloads['"]/
  );

  // Library files are retrieved only through an authenticated,
  // ownership-aware API route.
  assert.match(
    libraryController,
    /@Get\(['"]:id\/file['"]\)/
  );

  assert.match(
    libraryController,
    /JwtAuthGuard/
  );

  assert.match(
    libraryService,
    /resolveOwnedFile/
  );

  // Generated job artifacts follow the same ownership boundary.
  assert.match(
    jobsController,
    /@Get\(['"]:id\/artifact['"]\)/
  );

  assert.match(
    jobsController,
    /JwtAuthGuard/
  );

  assert.match(
    jobsService,
    /resolveOwnedArtifact/
  );

  // Storage paths are resolved by the server rather than accepted
  // from request path parameters.

  assert.doesNotMatch(
    libraryController,
    /filename.*@Param/
  );


  assert.doesNotMatch(
    jobsController,
    /filename.*@Param/
  );

});

test('security S3-A2 fetches private artifacts through authenticated HTTP', () => {
  const jobsService = read(
    'apps/frontend/src/app/services/jobs.service.ts'
  );

  const generationPage = read(
    'apps/frontend/src/app/features/music-generation/music-generation-page.component.ts'
  );

  const backendJobs = read(
    'apps/backend/src/jobs/jobs.service.ts'
  );

  // Generated artifacts are advertised only through the guarded API.

  assert.doesNotMatch(
    backendJobs,
    /\/downloads\/jobs\//
  );

  assert.match(
    backendJobs,
    /\/api\/jobs\/\$\{jobId\}\/artifact/
  );

  // Angular retrieves the protected file through HttpClient so the
  // existing auth interceptor can attach the access bearer token.
  assert.match(
    jobsService,
    /getArtifact\(\s*id:\s*string\s*\)/
  );

  assert.match(
    jobsService,
    /responseType:\s*['"]blob['"]/
  );

  assert.match(
    jobsService,
    /\/artifact/
  );

  // The audio element receives only a local object URL, never the
  // protected API URL directly.
  assert.match(
    generationPage,
    /JobsService/
  );

  assert.match(
    generationPage,
    /createObjectURL/
  );

  assert.match(
    generationPage,
    /revokeObjectURL/
  );


  assert.doesNotMatch(
    generationPage,
    /generatedAudioUrl\s*=\s*typeof\s+outputPath/
  );

  // Failed generation must never attempt artifact retrieval.
  const failedJobBranchStart = generationPage.indexOf(
    "} else if (job.status === 'failed') {"
  );

  const cancelledJobBranchStart = generationPage.indexOf(
    "} else if (job.status === 'cancelled') {",
    failedJobBranchStart
  );

  assert.ok(
    failedJobBranchStart >= 0,
    'Failed-job branch must exist.'
  );

  assert.ok(
    cancelledJobBranchStart > failedJobBranchStart,
    'Cancelled-job branch must follow failed-job branch.'
  );

  assert.doesNotMatch(
    generationPage.slice(
      failedJobBranchStart,
      cancelledJobBranchStart
    ),
    /loadGeneratedArtifact/
  );

});

test('security S3-B hardens library uploads and owned storage', () => {
  const controller = read(
    'apps/backend/src/library/library.controller.ts'
  );

  const service = read(
    'apps/backend/src/library/library.service.ts'
  );

  const dto = read(
    'apps/backend/src/library/dto/library.dto.ts'
  );

  // Multer must reject oversized requests before an unbounded upload
  // reaches application storage.
  assert.match(
    controller,
    /FileInterceptor\(\s*['"]file['"]\s*,\s*\{[\s\S]*limits:\s*\{[\s\S]*fileSize:/
  );

  assert.match(
    service,
    /MAX_LIBRARY_UPLOAD_BYTES/
  );

  // Upload policy must explicitly validate type, MIME, extension and size.
  assert.match(
    service,
    /validateUploadFile/
  );

  assert.match(
    service,
    /BadRequestException/
  );

  assert.match(
    service,
    /path\.extname\(file\.originalname\)\.toLowerCase\(\)/
  );

  assert.match(
    service,
    /file\.size\s*>\s*MAX_LIBRARY_UPLOAD_BYTES/
  );

  // Unsupported or ambiguous content must fail closed.
  assert.doesNotMatch(
    service,
    /['"]application\/octet-stream['"]\s*:\s*['"]mp3['"]/
  );

  assert.doesNotMatch(
    service,
    /mimeToFileType\[file\.mimetype\]\s*\|\|\s*['"]mp3['"]/
  );

  // Inspect the upload write path itself. Retrieval already contains
  // user-scoped path logic from S3-A and must not satisfy this gate.
  const uploadMethodStart = service.indexOf(
    '  uploadFile('
  );

  const uploadMethodEnd = service.indexOf(
    '  private mapToDto(',
    uploadMethodStart
  );

  assert.ok(
    uploadMethodStart >= 0,
    'Library upload method must exist.'
  );

  assert.ok(
    uploadMethodEnd > uploadMethodStart,
    'Library upload method boundary must be discoverable.'
  );

  const uploadMethod = service.slice(
    uploadMethodStart,
    uploadMethodEnd
  );

  // Uploads must be physically segregated by authenticated user.
  assert.match(
    uploadMethod,
    /const userRoot\s*=\s*path\.(?:resolve|join)\(\s*this\.uploadDir,\s*userId\s*\)/
  );

  assert.match(
    uploadMethod,
    /fs\.mkdir\(\s*userRoot,\s*\{\s*recursive:\s*true\s*\}\s*\)/
  );

  assert.match(
    uploadMethod,
    /const filePath\s*=\s*path\.(?:resolve|join)\(\s*userRoot,\s*uniqueFilename\s*\)/
  );

  assert.match(
    uploadMethod,
    /\/uploads\/library\/\$\{userId\}\//
  );

  // Filesystem locators are server-owned implementation details.
  assert.doesNotMatch(
    dto,
    /fileUrl!:\s*string/
  );

  // Deletion must preserve the same user-specific filesystem boundary
  // as retrieval rather than collapsing a locator to basename alone.
  assert.match(
    service,
    /deleteOwnedFile/
  );

  assert.doesNotMatch(
    service,
    /path\.join\(\s*this\.uploadDir,\s*filename\s*\)/
  );


  // Library counters must also preserve ownership.
  assert.match(
    controller,
    /incrementPlayCount\(id, req\.user\.userId\)/
  );

  assert.match(
    controller,
    /incrementDownloadCount\(id, req\.user\.userId\)/
  );

  assert.match(
    service,
    /incrementPlayCount\([\s\S]*userId:\s*string[\s\S]*findOneAndUpdate/
  );

  assert.match(
    service,
    /incrementDownloadCount\([\s\S]*userId:\s*string[\s\S]*findOneAndUpdate/
  );
});

test('security S3-C keeps qualification artifacts on authenticated routes', () => {
  const qualifierPaths = [
    'scripts/qualify-musicgen-small.cjs',
    'scripts/qualify-musicgen-stereo-small.cjs',
    'scripts/qualify-diffsinger-job.cjs',
    'scripts/qualify-stable-audio-3-job.cjs',
    'scripts/qualify-ace-step-job.cjs',
  ];

  for (const qualifierPath of qualifierPaths) {
    const qualifier = read(
      qualifierPath
    );

    assert.doesNotMatch(
      qualifier,
      /\/downloads\/jobs\//
    );

    assert.match(
      qualifier,
      /\/api\/jobs\/\$\{jobId\}\/artifact/
    );

    // Local qualification still inspects the generated WAV directly,
    // but the API locator no longer contains the storage filename.
    assert.match(
      qualifier,
      /['"]music\.wav['"]/
    );
  }

  const showcase = read(
    'scripts/generate-qualified-showcase.cjs'
  );

  const proxy = read(
    'apps/frontend/proxy.conf.json'
  );

  assert.doesNotMatch(
    showcase,
    /\/downloads\/jobs\//
  );

  assert.match(
    showcase,
    /fetchProtectedArtifact/
  );

  assert.match(
    showcase,
    /async function fetchProtectedArtifact[\s\S]*authorization:\s*`Bearer \$\{token\}`/
  );

  assert.match(
    showcase,
    /\/api\/jobs\/\$\{jobId\}\/artifact/
  );

  assert.doesNotMatch(
    proxy,
    /["']\/downloads["']/
  );
});

test('security S3-C2 authenticates runtime selection in qualification scripts', () => {
  const selector = read(
    'scripts/runtime-selection-client.cjs'
  );

  assert.match(
    selector,
    /\/api\/music\/runtime\/select/
  );

  assert.match(
    selector,
    /authorization:\s*`Bearer \$\{acceptedToken\}`/
  );

  assert.match(
    selector,
    /authorization:\s*`Bearer \$\{statusToken\}`/
  );

  assert.match(
    selector,
    /tokenProvider/
  );

  assert.match(
    selector,
    /resolveAccessToken/
  );

  assert.match(
    selector,
    /state\s*!==\s*['"]accepted['"]/
  );

  assert.match(
    selector,
    /operationId/
  );

  const scriptPaths = [
    'scripts/qualify-musicgen-small.cjs',
    'scripts/qualify-musicgen-stereo-small.cjs',
    'scripts/qualify-diffsinger-runtime.cjs',
    'scripts/qualify-diffsinger-inference.cjs',
    'scripts/qualify-diffsinger-job.cjs',
    'scripts/qualify-stable-audio-3-small-music.cjs',
    'scripts/qualify-stable-audio-3-job.cjs',
    'scripts/qualify-ace-step-job.cjs',
    'scripts/generate-qualified-showcase.cjs',
  ];

  for (const scriptPath of scriptPaths) {
    const script = read(scriptPath);

    assert.match(
      script,
      /runtime-selection-client\.cjs/,
      `${scriptPath} must use the authenticated selector`
    );

    assert.match(
      script,
      /selectRuntimeModel\s*\(/,
      `${scriptPath} must use protected async selection`
    );

    assert.doesNotMatch(
      script,
      /\/api\/music\/runtime\/select/,
      `${scriptPath} must not bypass the shared authenticated selector`
    );
  }
});

test('qualification clients use authenticated async runtime selection helper', () => {
  const helperPath =
    'scripts/runtime-selection-client.cjs';

  assert.equal(
    existsSync(
      path.join(
        root,
        helperPath
      )
    ),
    true,
    'shared runtime selection helper must exist'
  );

  const helper = read(helperPath);

  assert.match(
    helper,
    /async function selectRuntimeModel/
  );

  assert.match(
    helper,
    /async function authenticateQualificationUser/
  );

  assert.match(
    helper,
    /\/api\/music\/runtime\/select/
  );

  assert.match(
    helper,
    /\/api\/music\/runtime\/status/
  );

  assert.match(
    helper,
    /authorization:\s*`Bearer \$\{acceptedToken\}`/
  );

  assert.match(
    helper,
    /authorization:\s*`Bearer \$\{statusToken\}`/
  );

  assert.match(
    helper,
    /tokenProvider/
  );

  assert.match(
    helper,
    /resolveAccessToken/
  );

  assert.match(
    helper,
    /state\s*!==\s*['"]accepted['"]/
  );

  assert.match(
    helper,
    /operationId/
  );

  assert.match(
    helper,
    /state\s*===\s*['"]error['"]/
  );

  assert.match(
    helper,
    /state\s*===\s*['"]ready['"]/
  );

  const clients = [
    'scripts/qualify-musicgen-small.cjs',
    'scripts/qualify-musicgen-stereo-small.cjs',
    'scripts/qualify-diffsinger-runtime.cjs',
    'scripts/qualify-diffsinger-inference.cjs',
    'scripts/qualify-diffsinger-job.cjs',
    'scripts/qualify-stable-audio-3-small-music.cjs',
    'scripts/qualify-stable-audio-3-job.cjs',
    'scripts/qualify-ace-step-job.cjs',
    'scripts/generate-qualified-showcase.cjs',
  ];

  for (const clientPath of clients) {
    const client = read(clientPath);

    assert.match(
      client,
      /runtime-selection-client\.cjs/,
      `${clientPath} must use the shared runtime selection client`
    );

    assert.match(
      client,
      /selectRuntimeModel\s*\(/,
      `${clientPath} must wait for async correlated runtime readiness`
    );

    assert.doesNotMatch(
      client,
      /\/api\/music\/runtime\/select/,
      `${clientPath} must not implement runtime selection independently`
    );
  }

  const directQualificationClients = [
    'scripts/qualify-diffsinger-runtime.cjs',
    'scripts/qualify-diffsinger-inference.cjs',
    'scripts/qualify-stable-audio-3-small-music.cjs',
  ];

  for (const clientPath of directQualificationClients) {
    const client = read(clientPath);

    assert.match(
      client,
      /authenticateQualificationUser\s*\(/,
      `${clientPath} must authenticate before protected runtime mutation`
    );
  }

  const pkg = JSON.parse(
    read('package.json')
  );

  assert.match(
    pkg.scripts['lint:scripts'],
    /runtime-selection-client\.cjs/,
    'shared runtime selection helper must participate in script syntax checks'
  );
});


test('qualified showcase owns an isolated frontend proxy to its fresh backend', () => {
  const runner =
    read('scripts/run-qualified-showcase.sh');

  const normalProxy =
    read('apps/frontend/proxy.conf.json');

  assert.match(
    normalProxy,
    /localhost:3000/
  );

  assert.match(
    runner,
    /FRONTEND_PORT=4214/
  );

  assert.match(
    runner,
    /FRONTEND="http:\/\/localhost:\$\{FRONTEND_PORT\}"/
  );

  assert.match(
    runner,
    /PROXY_CONFIG="\$OUT\/proxy-3114\.json"/
  );

  assert.match(
    runner,
    /"target": "\$BASE"/
  );

  assert.match(
    runner,
    /hpnpm exec nx serve frontend/
  );

  assert.doesNotMatch(
    runner,
    /node_modules\/nx\/bin\/nx\.js/
  );

  assert.match(
    runner,
    /--proxy-config="\$PROXY_CONFIG"/
  );

  assert.match(
    runner,
    /HARMONIA_SHOWCASE_BACKEND_BASE="\$BASE"/
  );

  assert.match(
    runner,
    /HARMONIA_SHOWCASE_FRONTEND_BASE="\$FRONTEND"/
  );

  assert.doesNotMatch(
    runner,
    /FRONTEND="http:\/\/localhost:4200"/
  );
});

test('qualified showcase runner syntax is part of script lint', () => {
  const pkg =
    JSON.parse(read('package.json'));

  assert.match(
    pkg.scripts['lint:scripts'],
    /bash -n scripts\/run-qualified-showcase\.sh/
  );
});


test('hardware-aware model qualification matrix covers every current qualified generator', () => {
  const pkg =
    JSON.parse(
      read('package.json')
    );

  const qualifier =
    read(
      'scripts/qualify-model-hardware-matrix.cjs'
    );

  const caseContract =
    read(
      'scripts/model-qualification-case-contract.test.cjs'
    );

  const cases =
    read(
      'tests/model-qualification/model-generation-cases.cjs'
    );

  const e2e =
    read(
      'tests/e2e/music-runtime-hardware-catalog.spec.ts'
    );

  assert.equal(
    pkg.scripts['qualify:model-matrix'],
    'node scripts/qualify-model-hardware-matrix.cjs'
  );

  assert.equal(
    pkg.scripts['qualify:model-matrix:plan'],
    'node scripts/qualify-model-hardware-matrix.cjs --plan'
  );

  assert.equal(
    pkg.scripts['test:model-qualification-cases'],
    'node --test scripts/model-qualification-case-contract.test.cjs'
  );

  assert.match(
    qualifier,
    /hardwareFit/
  );

  assert.match(
    qualifier,
    /availability ===[\s\S]*'installed'/
  );

  assert.match(
    qualifier,
    /model\.selectable === true/
  );

  assert.match(
    qualifier,
    /recommended/
  );

  assert.match(
    qualifier,
    /supported/
  );

  assert.match(
    qualifier,
    /MODEL_HARDWARE_MATRIX_GREEN/
  );

  assert.match(
    qualifier,
    /model\.runtimeModelId/
  );

  assert.match(
    qualifier,
    /frontend artifact must be byte-identical/
  );

  for (
    const modelId of [
      'musicgen-small',
      'musicgen-stereo-small',
      'diffsinger-acoustic-hifigan',
      'stable-audio-3-small-music',
      'acestep-v15-turbo-06b',
      'diffrhythm-v12-base',
    ]
  ) {
    assert.match(
      cases,
      new RegExp(modelId)
    );
  }

  assert.match(
    caseContract,
    /smoke/
  );

  assert.match(
    caseContract,
    /deep/
  );

  assert.match(
    e2e,
    /\/generate\/music/
  );

  assert.match(
    e2e,
    /disabledReason/
  );

  assert.match(
    e2e,
    /aria-disabled/
  );
});


test(
  'male Mandarin OpenUTAU DiffSinger remains non-runnable until local runtime installation',
  () => {
    const catalog = read(
      'apps/backend/src/music-runtime/music-model.catalog.ts'
    );

    const providerId =
      "id: 'diffsinger-openutau'";

    const modelId =
      "id: 'diffsinger-openutau-mandarin-male-local'";

    const providerStart =
      catalog.indexOf(
        providerId
      );

    assert.ok(
      providerStart >= 0,
      'OpenUTAU provider must exist'
    );

    const providerEnd =
      catalog.indexOf(
        '\n  },',
        providerStart
      );

    assert.ok(
      providerEnd > providerStart
    );

    const provider =
      catalog.slice(
        providerStart,
        providerEnd + 5
      );

    assert.match(
      provider,
      /runtimeInstalled:\s*false/
    );

    const modelStart =
      catalog.indexOf(
        modelId
      );

    assert.ok(
      modelStart >= 0,
      'male Mandarin local model must exist'
    );

    const modelEnd =
      catalog.indexOf(
        '\n  },',
        modelStart
      );

    assert.ok(
      modelEnd > modelStart
    );

    const model =
      catalog.slice(
        modelStart,
        modelEnd + 5
      );

    assert.match(
      model,
      /providerId:\s*'diffsinger-openutau'/
    );

    assert.match(
      model,
      /runtimeModelId:\s*'mandarin-male-local'/
    );

    assert.match(
      model,
      /availability:\s*'planned'/
    );

    assert.match(
      model,
      /commercialUse:\s*'review-required'/
    );

    assert.match(
      model,
      /'mandarin'/
    );

    assert.match(
      model,
      /'male-voice'/
    );

    assert.match(
      model,
      /not bundled or downloaded/i
    );
  }
);


test(
  'OpenUTAU DiffSinger provider shell validates external voicebanks without bundling model weights',
  () => {
    const dockerfile = read(
      'Dockerfile.diffsinger-openutau'
    );

    const entrypoint = read(
      'entrypoint.diffsinger-openutau.sh'
    );

    const validator = read(
      'scripts/diffsinger_openutau_voicebank_validator.py'
    );

    const compose = read(
      'docker-compose.yml'
    );

    const gpuCompose = read(
      'docker-compose.gpu.yml'
    );

    const dockerignore = read(
      '.dockerignore'
    );

    const catalog = read(
      'apps/backend/src/music-runtime/music-model.catalog.ts'
    );

    assert.match(
      dockerfile,
      /FROM python:3\.12-slim/
    );

    assert.match(
      dockerfile,
      /DIFFSINGER_UTAU_VERSION=0\.3\.8/
    );

    assert.match(
      dockerfile,
      /--no-deps/
    );

    assert.match(
      entrypoint,
      /expected = ["']0\.3\.8["']/
    );

    assert.match(
      validator,
      /dsdur\/dsconfig\.yaml/
    );

    assert.match(
      validator,
      /dspitch\/dsconfig\.yaml/
    );

    assert.match(
      validator,
      /dsvariance\/dsconfig\.yaml/
    );

    assert.match(
      validator,
      /dsvocoder\/vocoder\.yaml/
    );

    assert.match(
      validator,
      /inside_root/
    );

    assert.doesNotMatch(
      validator,
      /urllib|requests|curl|wget/
    );

    assert.match(
      compose,
      /diffsinger-openutau:[\s\S]*Dockerfile\.diffsinger-openutau/
    );

    assert.match(
      compose,
      /container_name:\s*harmonia-diffsinger-openutau/
    );

    assert.match(
      compose,
      /model-diffsinger-openutau/
    );

    assert.match(
      compose,
      /pip show diffsinger-utau/
    );

    assert.match(
      compose,
      /\.\/models\/diffsinger-openutau:\/workspace\/models\/diffsinger-openutau:ro/
    );

    assert.match(
      gpuCompose,
      /diffsinger-openutau:[\s\S]*runtime:\s*nvidia/
    );

    assert.match(
      dockerignore,
      /^models$/m
    );

    const providerStart =
      catalog.indexOf(
        "id: 'diffsinger-openutau'"
      );

    const providerEnd =
      catalog.indexOf(
        '\n  },',
        providerStart
      );

    const provider =
      catalog.slice(
        providerStart,
        providerEnd + 5
      );

    assert.match(
      provider,
      /runtimeInstalled:\s*false/
    );
  }
);


test(
  'DiffRhythm provider runtime is isolated, offline, GPU-profiled, and catalog-integrated',
  () => {
    const dockerfilePath =
      path.join(
        root,
        'Dockerfile.diffrhythm'
      );

    const providerPath =
      path.join(
        root,
        'scripts/diffrhythm_provider_server.py'
      );

    assert.equal(
      existsSync(dockerfilePath),
      true,
      'DiffRhythm must have an isolated provider Dockerfile'
    );

    assert.equal(
      existsSync(providerPath),
      true,
      'DiffRhythm must have a provider health server'
    );

    const dockerfile =
      read(
        'Dockerfile.diffrhythm'
      );

    const compose =
      read(
        'docker-compose.yml'
      );

    const gpuCompose =
      read(
        'docker-compose.gpu.yml'
      );

    const provider =
      read(
        'scripts/diffrhythm_provider_server.py'
      );

    /*
     * M16-E1 evolves B1's shell into a persistent provider.
     * HTTP ownership remains in the provider module while
     * readiness/model/busy state is delegated to the reusable
     * DiffRhythmRuntime.
     */
    const runtimePath =
      path.join(
        root,
        'scripts/diffrhythm_runtime.py'
      );

    const runtimeStateSource =
      existsSync(runtimePath)
        ? read(
            'scripts/diffrhythm_runtime.py'
          )
        : provider;

    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    /*
     * Pinned source shell.
     *
     * M16-B must establish the isolated runtime image before
     * model-registry acquisition is introduced.
     */
    assert.match(
      dockerfile,
      /ARG DIFFRHYTHM_REF=28ad63c0f096fe2ee258bcabbcf081d5d9366afd/
    );

    assert.match(
      dockerfile,
      /ASLP-lab\/DiffRhythm\.git/
    );

    assert.match(
      dockerfile,
      /git checkout --detach "\$\{DIFFRHYTHM_REF\}"/
    );

    /*
     * Runtime must start offline.
     *
     * Model acquisition belongs to Harmonia's model manager,
     * never provider startup.
     */
    assert.match(
      dockerfile,
      /HF_HUB_OFFLINE=1/
    );

    assert.match(
      dockerfile,
      /TRANSFORMERS_OFFLINE=1/
    );

    assert.match(
      dockerfile,
      /HARMONIA_DIFFRHYTHM_MODELS_ROOT=\/workspace\/models\/diffrhythm/
    );

    /*
     * Lightweight shell health server.
     *
     * It must boot without loading DiffRhythm, MuQ or the VAE.
     */
    assert.match(
      provider,
      /8767/
    );

    assert.match(
      provider,
      /\/health/
    );

    assert.match(
      provider,
      /"ok"/
    );

    assert.match(
      runtimeStateSource,
      /"ready"/
    );

    assert.match(
      runtimeStateSource,
      /"model"/
    );

    assert.match(
      runtimeStateSource,
      /"busy"/
    );

    assert.doesNotMatch(
      provider,
      /hf_hub_download/
    );

    assert.doesNotMatch(
      provider,
      /from_pretrained/
    );

    /*
     * Canonical Compose service.
     */
    assert.match(
      compose,
      /^\s{2}diffrhythm:\s*$/m
    );

    assert.match(
      compose,
      /dockerfile:\s*Dockerfile\.diffrhythm/
    );

    assert.match(
      compose,
      /image:\s*harmonia\/diffrhythm:dev/
    );

    assert.match(
      compose,
      /container_name:\s*harmonia-diffrhythm/
    );

    assert.match(
      compose,
      /model-diffrhythm/
    );

    assert.match(
      compose,
      /HARMONIA_DIFFRHYTHM_PORT:\s*"8767"/
    );

    assert.match(
      compose,
      /HF_HUB_OFFLINE:\s*"1"/
    );

    assert.match(
      compose,
      /TRANSFORMERS_OFFLINE:\s*"1"/
    );

    assert.match(
      compose,
      /\.\/models\/diffrhythm:\/workspace\/models\/diffrhythm:ro/
    );

    assert.match(
      compose,
      /diffrhythm_provider_server\.py/
    );

    /*
     * Provider must remain internal-only.
     */
    const diffRhythmServiceMatch =
      compose.match(
        /^\s{2}diffrhythm:\s*$([\s\S]*?)(?=^\s{2}[A-Za-z0-9_.-]+:\s*$|^networks:)/m
      );

    assert.ok(
      diffRhythmServiceMatch,
      'DiffRhythm Compose service block must exist'
    );

    assert.doesNotMatch(
      diffRhythmServiceMatch[1],
      /^\s{4}ports:/m,
      'DiffRhythm must not publish a host port'
    );

    /*
     * GPU comes only from the optional GPU overlay.
     */
    assert.match(
      gpuCompose,
      /^\s{2}diffrhythm:\s*$/m
    );

    assert.match(
      gpuCompose,
      /diffrhythm:[\s\S]*runtime:\s*nvidia/
    );

    assert.match(
      gpuCompose,
      /diffrhythm:[\s\S]*NVIDIA_VISIBLE_DEVICES:\s*all/
    );

    /*
     * Provider/runtime integration does not by itself make
     * the Base model selectable.
     */
    const providerDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      providerDefinition,
      'DiffRhythm provider definition must remain in the catalog'
    );

    const baseModelDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      baseModelDefinition,
      'DiffRhythm v1.2 Base definition must remain in the catalog'
    );

    assert.match(
      baseModelDefinition,
      /availability:\s*'installed'/
    );
  }
);


test(
  'DiffRhythm D1 runtime image pins CUDA stack and resolves the qualified cache offline',
  () => {
    const probePath =
      path.join(
        root,
        'scripts/diffrhythm_runtime_probe.py'
      );

    const requirementsPath =
      path.join(
        root,
        'requirements.diffrhythm-runtime.txt'
      );

    assert.equal(
      existsSync(probePath),
      true,
      'DiffRhythm D1 must provide a CUDA/runtime probe before enabling model loading'
    );

    assert.equal(
      existsSync(requirementsPath),
      true,
      'DiffRhythm D1 must provide a pinned runtime requirements file'
    );

    const dockerfile =
      read(
        'Dockerfile.diffrhythm'
      );

    const probe =
      read(
        'scripts/diffrhythm_runtime_probe.py'
      );

    const requirements =
      read(
        'requirements.diffrhythm-runtime.txt'
      );

    /*
     * DiffRhythm v1.2 upstream pairs with
     * PyTorch/Torchaudio 2.6.0.
     *
     * Harmonia must pin the CUDA wheel explicitly
     * rather than letting pip choose a CPU build or
     * a future incompatible Torch generation.
     */
    assert.match(
      dockerfile,
      /nvidia\/cuda:12\.4/
    );

    assert.match(
      dockerfile,
      /download\.pytorch\.org\/whl\/cu124/
    );

    assert.match(
      dockerfile,
      /torch==2\.6\.0/
    );

    assert.match(
      dockerfile,
      /torchaudio==2\.6\.0/
    );

    /*
     * Core upstream runtime compatibility pins.
     */
    assert.match(
      requirements,
      /^transformers==4\.49\.0$/m
    );

    assert.match(
      requirements,
      /^muq==0\.1\.0$/m
    );

    assert.match(
      requirements,
      /^accelerate==1\.4\.0$/m
    );

    assert.match(
      requirements,
      /^torchdiffeq==0\.2\.5$/m
    );

    assert.match(
      requirements,
      /^x-transformers==2\.1\.2$/m
    );

    assert.match(
      requirements,
      /^librosa==0\.10\.2\.post1$/m
    );

    assert.match(
      requirements,
      /^ema-pytorch==0\.7\.7$/m
    );

    assert.match(
      requirements,
      /^mutagen==1\.47\.0$/m
    );

    /*
     * Provider source calls Hugging Face with
     * cache_dir="./pretrained".
     *
     * Redirect that exact upstream cache location
     * to the registry-managed provider cache.
     */
    assert.match(
      dockerfile,
      /\/opt\/DiffRhythm\/pretrained/
    );

    assert.match(
      dockerfile,
      /\/workspace\/models\/diffrhythm\/huggingface/
    );

    /*
     * Runtime image remains incapable of network
     * model acquisition during qualification/use.
     */
    assert.match(
      dockerfile,
      /HF_HUB_OFFLINE=1/
    );

    assert.match(
      dockerfile,
      /TRANSFORMERS_OFFLINE=1/
    );

    /*
     * D1 probe validates dependencies + CUDA +
     * local cache metadata only.
     *
     * It must NOT instantiate the DiffRhythm model
     * or VAE yet; weight residency belongs to D2.
     */
    assert.match(
      probe,
      /import torch/
    );

    assert.match(
      probe,
      /import torchaudio/
    );

    assert.match(
      probe,
      /import transformers/
    );

    assert.match(
      probe,
      /from muq import MuQMuLan/
    );

    assert.match(
      probe,
      /torch\.cuda\.is_available/
    );

    assert.match(
      probe,
      /torch\.cuda\.get_device_name/
    );

    assert.match(
      probe,
      /torch\.cuda\.get_device_properties/
    );

    assert.match(
      probe,
      /memory_allocated/
    );

    assert.match(
      probe,
      /memory_reserved/
    );

    /*
     * All five pinned repositories must be resolved
     * from the qualified local cache only.
     */
    for (
      const repoId of [
        'ASLP-lab/DiffRhythm-1_2',
        'ASLP-lab/DiffRhythm-vae',
        'OpenMuQ/MuQ-MuLan-large',
        'OpenMuQ/MuQ-large-msd-iter',
        'FacebookAI/xlm-roberta-base',
      ]
    ) {
      assert.ok(
        probe.includes(repoId),
        'runtime probe must resolve pinned local repo ' +
          repoId
      );
    }

    assert.match(
      probe,
      /local_files_only\s*=\s*True/
    );

    assert.doesNotMatch(
      probe,
      /prepare_model\s*\(/
    );

    assert.doesNotMatch(
      probe,
      /torch\.jit\.load\s*\(/
    );

    assert.doesNotMatch(
      probe,
      /MuQMuLan\.from_pretrained\s*\(/
    );

    /*
     * Probe is baked into the image but model
     * readiness remains false until D2 load proof.
     */
    assert.match(
      dockerfile,
      /diffrhythm_runtime_probe\.py/
    );

    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const providerDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      providerDefinition
    );

    const modelDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      modelDefinition
    );

    assert.match(
      modelDefinition,
      /availability:\s*'installed'/
    );
  }
);


test(
  'DiffRhythm runtime exposes pinned upstream source on Python import path',
  () => {
    const dockerfile =
      read(
        'Dockerfile.diffrhythm'
      );

    assert.match(
      dockerfile,
      /ENV PYTHONPATH=\/opt\/DiffRhythm/
    );

    assert.match(
      dockerfile,
      /ARG DIFFRHYTHM_REF=28ad63c0f096fe2ee258bcabbcf081d5d9366afd/
    );

    assert.match(
      dockerfile,
      /git checkout --detach "\$\{DIFFRHYTHM_REF\}"/
    );
  }
);


test(
  'DiffRhythm D3 residency probe stages MuQ release before CFM and VAE hardware qualification',
  () => {
    const probePath =
      path.join(
        root,
        'scripts/diffrhythm_residency_probe.py'
      );

    assert.equal(
      existsSync(probePath),
      true,
      'DiffRhythm D3 must provide a staged real-weight residency probe'
    );

    const probe =
      read(
        'scripts/diffrhythm_residency_probe.py'
      );

    /*
     * D3 operates only on the already-qualified
     * local cache and must remain network-independent.
     */
    assert.match(
      probe,
      /HF_HUB_OFFLINE/
    );

    assert.match(
      probe,
      /TRANSFORMERS_OFFLINE/
    );

    assert.match(
      probe,
      /local_files_only\s*=\s*True/
    );

    /*
     * Use the 95-second Base architecture only.
     */
    assert.match(
      probe,
      /max_frames\s*=\s*2048/
    );

    /*
     * Stage 1:
     * load the exact MuQ-MuLan component used by
     * upstream DiffRhythm and exercise a real text
     * style embedding before releasing it.
     */
    assert.match(
      probe,
      /MuQMuLan\.from_pretrained/
    );

    assert.match(
      probe,
      /OpenMuQ\/MuQ-MuLan-large/
    );

    assert.match(
      probe,
      /get_style_prompt/
    );

    /*
     * The style embedding must survive on CPU so
     * MuQ itself can leave CUDA before diffusion.
     */
    assert.match(
      probe,
      /style_prompt.*\.cpu\s*\(/
    );

    /*
     * Stage transition must explicitly release MuQ.
     */
    assert.match(
      probe,
      /muq.*\.to\s*\(\s*["']cpu["']\s*\)/
    );

    assert.match(
      probe,
      /del\s+muq/
    );

    assert.match(
      probe,
      /gc\.collect\s*\(/
    );

    assert.match(
      probe,
      /torch\.cuda\.empty_cache\s*\(/
    );

    /*
     * Stage 2:
     * reproduce the actual Base CFM construction.
     */
    assert.match(
      probe,
      /CFM\s*\(/
    );

    assert.match(
      probe,
      /DiT\s*\(/
    );

    assert.match(
      probe,
      /diffrhythm-1b\.json/
    );

    assert.match(
      probe,
      /cfm_model\.pt/
    );

    assert.match(
      probe,
      /load_checkpoint/
    );

    /*
     * Stage 3:
     * add the real TorchScript VAE while CFM is
     * still resident to measure combined residency.
     */
    assert.match(
      probe,
      /vae_model\.pt/
    );

    assert.match(
      probe,
      /torch\.jit\.load/
    );

    /*
     * Every stage must expose current and peak VRAM.
     */
    assert.match(
      probe,
      /torch\.cuda\.memory_allocated/
    );

    assert.match(
      probe,
      /torch\.cuda\.memory_reserved/
    );

    assert.match(
      probe,
      /torch\.cuda\.max_memory_allocated/
    );

    assert.match(
      probe,
      /torch\.cuda\.max_memory_reserved/
    );

    assert.match(
      probe,
      /torch\.cuda\.reset_peak_memory_stats/
    );

    assert.match(
      probe,
      /torch\.cuda\.synchronize/
    );

    /*
     * Required machine-readable stages.
     */
    for (
      const stage of [
        'baseline',
        'muq-loaded',
        'style-embedded',
        'muq-released',
        'cfm-loaded',
        'cfm-plus-vae-loaded',
        'released',
      ]
    ) {
      assert.ok(
        probe.includes(
          '"' + stage + '"'
        ),
        'D3 residency probe must report stage ' +
          stage
      );
    }

    /*
     * D3 is measurement only. It must not launch
     * diffusion or VAE decode yet.
     */
    assert.doesNotMatch(
      probe,
      /\binference\s*\(/
    );

    assert.doesNotMatch(
      probe,
      /\bdecode_audio\s*\(/
    );

    /*
     * Catalog stays unavailable until a later
     * generation qualification succeeds.
     */
    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const providerDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      providerDefinition
    );

    const modelDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      modelDefinition
    );

    assert.match(
      modelDefinition,
      /availability:\s*'installed'/
    );
  }
);


test(
  'DiffRhythm D3 shadow cache aliases MuQ XLM-R consumer key to pinned registry artifact',
  () => {
    const probe =
      read(
        'scripts/diffrhythm_residency_probe.py'
      );

    assert.match(
      probe,
      /QUALIFIED_CACHE_DIR\s*=\s*Path\("\.\/pretrained"\)\.resolve\(\)/
    );

    assert.match(
      probe,
      /CACHE_DIR\s*=\s*"\/tmp\/harmonia-diffrhythm-hf-cache"/
    );

    assert.match(
      probe,
      /"xlm-roberta-base":\s*XLMR_REPO/
    );

    assert.match(
      probe,
      /XLMR_REPO\s*=\s*"FacebookAI\/xlm-roberta-base"/
    );

    assert.match(
      probe,
      /alias_path\.symlink_to/
    );

    assert.match(
      probe,
      /target_is_directory=True/
    );

    /*
     * The qualified model cache remains the
     * immutable physical source. The alias exists
     * only in the ephemeral /tmp cache namespace.
     */
    assert.doesNotMatch(
      probe,
      /shutil\.copy/
    );

    assert.doesNotMatch(
      probe,
      /copytree/
    );
  }
);


test(
  'DiffRhythm D4 generates a real 95-second stereo WAV with released MuQ and chunked VAE decode',
  () => {
    const generatorPath =
      path.join(
        root,
        'scripts/diffrhythm_generate.py'
      );

    assert.equal(
      existsSync(generatorPath),
      true,
      'DiffRhythm D4 must provide a real generation runner'
    );

    const generator =
      read(
        'scripts/diffrhythm_generate.py'
      );

    /*
     * Qualification remains entirely offline and
     * uses the five already-qualified registry
     * snapshots.
     */
    assert.match(
      generator,
      /HF_HUB_OFFLINE/
    );

    assert.match(
      generator,
      /TRANSFORMERS_OFFLINE/
    );

    assert.match(
      generator,
      /local_files_only\s*=\s*True/
    );

    /*
     * Preserve the MuQ consumer-key alias discovered
     * during D3 without mutating or duplicating the
     * canonical XLM-R registry artifact.
     */
    assert.match(
      generator,
      /FacebookAI\/xlm-roberta-base/
    );

    assert.match(
      generator,
      /"xlm-roberta-base"/
    );

    assert.match(
      generator,
      /symlink_to/
    );

    /*
     * First qualified generation is specifically the
     * DiffRhythm v1.2 Base 95-second architecture.
     */
    assert.match(
      generator,
      /max_frames\s*=\s*2048/
    );

    assert.match(
      generator,
      /audio_length\s*=\s*95/
    );

    /*
     * Real style-conditioning path.
     */
    assert.match(
      generator,
      /MuQMuLan\.from_pretrained/
    );

    assert.match(
      generator,
      /get_style_prompt/
    );

    assert.match(
      generator,
      /style_prompt[\s\S]*?\.cpu\s*\(/
    );

    /*
     * MuQ must leave CUDA before diffusion starts.
     */
    assert.match(
      generator,
      /muq.*\.to\s*\(\s*["']cpu["']\s*\)/
    );

    assert.match(
      generator,
      /del\s+muq/
    );

    assert.match(
      generator,
      /gc\.collect\s*\(/
    );

    assert.match(
      generator,
      /torch\.cuda\.empty_cache\s*\(/
    );

    /*
     * Do not use upstream prepare_model(), because
     * that keeps MuQ resident alongside CFM + VAE.
     */
    assert.doesNotMatch(
      generator,
      /\bprepare_model\s*\(/
    );

    /*
     * Real Base diffusion model.
     */
    assert.match(
      generator,
      /CFM\s*\(/
    );

    assert.match(
      generator,
      /DiT\s*\(/
    );

    assert.match(
      generator,
      /diffrhythm-1b\.json/
    );

    assert.match(
      generator,
      /cfm_model\.pt/
    );

    assert.match(
      generator,
      /load_checkpoint/
    );

    /*
     * Real lyrics/token conditioning path is wired
     * even if the first qualification uses only a
     * small deterministic LRC fixture.
     */
    assert.match(
      generator,
      /get_lrc_token/
    );

    assert.match(
      generator,
      /get_negative_style_prompt/
    );

    /*
     * Real CFM sampling settings from pinned
     * upstream inference.
     */
    assert.match(
      generator,
      /\.sample\s*\(/
    );

    assert.match(
      generator,
      /steps\s*=\s*32/
    );

    assert.match(
      generator,
      /cfg_strength\s*=\s*4\.0/
    );

    /*
     * Real TorchScript VAE with the memory-friendly
     * chunked decode path.
     */
    assert.match(
      generator,
      /vae_model\.pt/
    );

    assert.match(
      generator,
      /torch\.jit\.load/
    );

    assert.match(
      generator,
      /decode_audio\s*\([\s\S]*chunked\s*=\s*True/
    );


    /*
     * Actual RTX 3080 generation proved decode
     * activation memory is the limiting stage.
     *
     * Preserve the completed diffusion latent,
     * release CFM completely, then decode with
     * VAE-only residency. Upstream chunk size 128
     * remains first choice; 64 is the OOM fallback.
     */
    assert.match(
      generator,
      /DECODE_CHUNK_SIZES\s*=\s*\(\s*128\s*,\s*64\s*\)/
    );

    assert.match(
      generator,
      /latent_checkpoint_path/
    );

    assert.match(
      generator,
      /torch\.save\s*\(/
    );

    assert.match(
      generator,
      /cfm\s*=\s*cfm\.to\s*\(\s*["']cpu["']\s*\)/
    );

    assert.match(
      generator,
      /del\s+cfm/
    );

    assert.match(
      generator,
      /after_cfm_release_vram/
    );

    assert.match(
      generator,
      /vae\s*=\s*load_vae\s*\(\s*\)/
    );

    assert.match(
      generator,
      /for\s+candidate_chunk_size\s+in\s+DECODE_CHUNK_SIZES/
    );


    /*
     * D4E proved that the TorchScript VAE's
     * activation explosion was caused by decoding
     * outside inference mode. Preserve upstream's
     * actual inference semantics.
     */
    assert.match(
      generator,
      /with\s+torch\.inference_mode\s*\(\s*\)\s*:/
    );

    assert.match(
      generator,
      /decodeInferenceMode/
    );


    /*
     * Diffusion-side lifecycle objects must be released exactly once.
     * They leave CUDA at the retained-latent boundary and must not
     * be referenced again by final VAE cleanup.
     */
    for (
      const name of [
        'style_prompt',
        'negative_style_prompt',
        'latent_prompt',
        'lrc_prompt',
        'cfm',
      ]
    ) {
      const releases =
        generator.match(
          new RegExp(
            '\\bdel\\s+' +
              name +
              '\\b',
            'g'
          )
        ) ?? [];

      assert.equal(
        releases.length,
        1,
        name +
          ' must be deleted exactly once'
      );
    }

    assert.match(
      generator,
      /chunk_size\s*=\s*[\s\S]*candidate_chunk_size/
    );

    /*
     * Qualified output contract.
     */
    assert.match(
      generator,
      /44100/
    );

    assert.match(
      generator,
      /torchaudio\.save/
    );

    assert.match(
      generator,
      /output\.wav/
    );

    assert.match(
      generator,
      /sampleRate/
    );

    assert.match(
      generator,
      /channels/
    );

    assert.match(
      generator,
      /durationSeconds/
    );

    assert.match(
      generator,
      /fileSizeBytes/
    );

    /*
     * D4 must measure actual inference-time VRAM,
     * which is distinct from D3 residency.
     */
    assert.match(
      generator,
      /torch\.cuda\.max_memory_allocated/
    );

    assert.match(
      generator,
      /torch\.cuda\.max_memory_reserved/
    );

    assert.match(
      generator,
      /torch\.cuda\.reset_peak_memory_stats/
    );

    /*
     * Absolutely no placeholder/synthetic fallback.
     */
    assert.doesNotMatch(
      generator,
      /placeholder/i
    );

    assert.doesNotMatch(
      generator,
      /write_placeholder/
    );

    /*
     * Provider/catalog remain unavailable until this
     * actual generation qualification succeeds.
     */
    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const providerDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      providerDefinition
    );

    const modelDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      modelDefinition
    );

    assert.match(
      modelDefinition,
      /availability:\s*'installed'/
    );
  }
);

test(
  'DiffRhythm E1 provider owns a reusable offline Base runtime with staged GPU generation',
  () => {
    const runtimePath =
      path.join(
        root,
        'scripts/diffrhythm_runtime.py'
      );

    assert.equal(
      existsSync(runtimePath),
      true,
      'DiffRhythm E1 must provide a reusable runtime module'
    );

    const runtime =
      read(
        'scripts/diffrhythm_runtime.py'
      );

    /*
     * Persistent provider process owns one reusable
     * runtime object rather than spawning Python for
     * every song.
     */
    assert.match(
      runtime,
      /class\s+DiffRhythmRuntime\b/
    );

    assert.match(
      runtime,
      /threading\.Lock\s*\(/
    );

    assert.doesNotMatch(
      runtime,
      /subprocess\./
    );

    assert.doesNotMatch(
      runtime,
      /\bPopen\s*\(/
    );

    /*
     * E1 qualifies v1.2 Base only.
     */
    assert.match(
      runtime,
      /diffrhythm-v12-base/
    );

    assert.match(
      runtime,
      /max_frames\s*=\s*2048/
    );

    assert.match(
      runtime,
      /audio_length\s*=\s*95/
    );

    /*
     * Exact registry-qualified model revisions.
     */
    assert.match(
      runtime,
      /ASLP-lab\/DiffRhythm-1_2/
    );

    assert.match(
      runtime,
      /185bdeb80541b9260d266c5f041859017441f307/
    );

    assert.match(
      runtime,
      /ASLP-lab\/DiffRhythm-vae/
    );

    assert.match(
      runtime,
      /74e2afacfd91dd1b96662c96dcef763c1258768b/
    );

    assert.match(
      runtime,
      /OpenMuQ\/MuQ-MuLan-large/
    );

    assert.match(
      runtime,
      /2e01c796b71dca71b45251384c04cd7b237c9020/
    );

    assert.match(
      runtime,
      /OpenMuQ\/MuQ-large-msd-iter/
    );

    assert.match(
      runtime,
      /0562a57814f6f8bbd9fdea0a25921a2fce1a841a/
    );

    assert.match(
      runtime,
      /FacebookAI\/xlm-roberta-base/
    );

    assert.match(
      runtime,
      /e73636d4f797dec63c3081bb6ed5c7b0bb3f2089/
    );

    /*
     * Runtime remains offline and resolves only
     * already-qualified cache contents.
     */
    assert.match(
      runtime,
      /local_files_only\s*=\s*True/
    );

    assert.match(
      runtime,
      /HF_HUB_OFFLINE/
    );

    assert.match(
      runtime,
      /TRANSFORMERS_OFFLINE/
    );

    /*
     * Preserve D3's MuQ XLM-R consumer-key alias.
     */
    assert.match(
      runtime,
      /"xlm-roberta-base"/
    );

    assert.match(
      runtime,
      /symlink_to/
    );

    /*
     * Persistent process-owned model state.
     */
    assert.match(
      runtime,
      /self\._muq/
    );

    assert.match(
      runtime,
      /self\._cfm/
    );

    assert.match(
      runtime,
      /self\._vae/
    );

    assert.match(
      runtime,
      /def\s+prepare\s*\(/
    );

    assert.match(
      runtime,
      /def\s+generate\s*\(/
    );

    /*
     * Harmonia provider recovery state.
     *
     * Keep these as literal assertions instead of
     * constructing a dynamic regular expression.
     */
    assert.match(
      runtime,
      /"ready"/
    );

    assert.match(
      runtime,
      /"busy"/
    );

    assert.match(
      runtime,
      /"model"/
    );

    assert.match(
      runtime,
      /"provider"/
    );

    assert.match(
      runtime,
      /"sourceRevision"/
    );

    assert.match(
      runtime,
      /"cuda"/
    );

    assert.match(
      runtime,
      /"gpu"/
    );

    assert.match(
      runtime,
      /"lastError"/
    );

    assert.match(
      runtime,
      /"offline"/
    );

    /*
     * Real E1 generation request surface.
     */
    assert.match(
      runtime,
      /prompt/
    );

    assert.match(
      runtime,
      /lyrics/
    );

    assert.match(
      runtime,
      /output/
    );

    assert.match(
      runtime,
      /seed/
    );

    assert.match(
      runtime,
      /\/workspace\/generated/
    );

    assert.match(
      runtime,
      /\/workspace\/exports/
    );

    /*
     * Preserve the D4-qualified GPU lifecycle:
     *
     * MuQ -> CPU style embedding -> release CUDA
     * CFM -> CPU latent -> release CUDA
     * VAE -> inference-mode chunk-128 decode
     */
    assert.match(
      runtime,
      /get_style_prompt/
    );

    assert.match(
      runtime,
      /style_prompt[\s\S]*?\.cpu\s*\(/
    );

    assert.match(
      runtime,
      /muq[\s\S]*?\.to\s*\(\s*["']cpu["']\s*\)/
    );

    assert.match(
      runtime,
      /cfm[\s\S]*?\.sample\s*\(/
    );

    assert.match(
      runtime,
      /steps\s*=\s*32/
    );

    assert.match(
      runtime,
      /cfg_strength\s*=\s*4\.0/
    );

    assert.match(
      runtime,
      /latent[\s\S]*?\.cpu\s*\(/
    );

    assert.match(
      runtime,
      /cfm[\s\S]*?\.to\s*\(\s*["']cpu["']\s*\)/
    );

    assert.match(
      runtime,
      /with\s+torch\.inference_mode\s*\(\s*\)\s*:/
    );

    assert.match(
      runtime,
      /decode_audio\s*\(/
    );

    assert.match(
      runtime,
      /chunked\s*=\s*True/
    );

    assert.match(
      runtime,
      /chunk_size\s*=\s*128/
    );

    assert.match(
      runtime,
      /44100/
    );

    assert.match(
      runtime,
      /torchaudio\.save\s*\(/
    );

    /*
     * Provider follows Harmonia's existing persistent
     * MusicGen / Stable Audio HTTP-provider shape.
     */
    const provider =
      read(
        'scripts/diffrhythm_provider_server.py'
      );

    assert.match(
      provider,
      /from\s+diffrhythm_runtime\s+import\s*(?:DiffRhythmRuntime|\([\s\S]*?\bDiffRhythmRuntime\b[\s\S]*?\))/
    );

    assert.match(
      provider,
      /RUNTIME\s*=\s*DiffRhythmRuntime\s*\(/
    );

    assert.match(
      provider,
      /RUNTIME\.prepare\s*\(/
    );

    assert.match(
      provider,
      /if\s+self\.path\s*==\s*["']\/health["']/
    );

    assert.match(
      provider,
      /RUNTIME\.status\s*\(/
    );

    assert.match(
      provider,
      /if\s+self\.path\s*!=\s*["']\/generate["']/
    );

    assert.match(
      provider,
      /RUNTIME\.generate\s*\(/
    );

    assert.match(
      provider,
      /Content-Length/
    );

    assert.match(
      provider,
      /65536/
    );

    /*
     * B1's shell-only behavior must be gone.
     */
    assert.doesNotMatch(
      provider,
      /model loading disabled/
    );

    assert.doesNotMatch(
      provider,
      /inference is not enabled/
    );

    /*
     * Ready sentinel represents a genuinely prepared
     * runtime, not merely an open HTTP port.
     */
    const prepareIndex =
      provider.indexOf(
        'RUNTIME.prepare('
      );

    const readyIndex =
      provider.indexOf(
        'READY_FILE.touch('
      );

    assert.ok(
      prepareIndex >= 0,
      'provider must prepare DiffRhythm runtime'
    );

    assert.ok(
      readyIndex > prepareIndex,
      'ready sentinel must follow runtime preparation'
    );

    /*
     * E1 qualification does not itself make Base
     * selectable. E2 may install provider ownership metadata
     * while availability remains planned.
     */
    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const providerDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      providerDefinition
    );

    const modelDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      modelDefinition
    );

    assert.match(
      modelDefinition,
      /availability:\s*'installed'/
    );
  }
);

test(
  'DiffRhythm E1C exposes stable resident identity and generation reuse state',
  () => {
    const runtime =
      read(
        'scripts/diffrhythm_runtime.py'
      );

    assert.match(
      runtime,
      /import\s+uuid/
    );

    assert.match(
      runtime,
      /self\._instance_id/
    );

    assert.match(
      runtime,
      /uuid\.uuid4\s*\(/
    );

    assert.match(
      runtime,
      /self\._prepare_count/
    );

    assert.match(
      runtime,
      /self\._generation_count/
    );

    for (
      const field of [
        '"instanceId"',
        '"processId"',
        '"prepareCount"',
        '"generationCount"',
        '"modelObjectIds"',
      ]
    ) {
      assert.ok(
        runtime.includes(field),
        'runtime health must expose ' + field
      );
    }

    assert.match(
      runtime,
      /self\._prepare_count\s*\+=\s*1/
    );

    assert.match(
      runtime,
      /self\._generation_count\s*\+=\s*1/
    );

    /*
     * Provider startup owns preparation.
     * A generation request must never recursively call
     * prepare() while holding the generation lock.
     */
    const generateStart =
      runtime.indexOf(
        '    def generate('
      );

    assert.ok(
      generateStart >= 0,
      'generate method missing'
    );

    const generateBlock =
      runtime.slice(
        generateStart
      );

    assert.doesNotMatch(
      generateBlock,
      /self\.prepare\s*\(/
    );

    assert.match(
      generateBlock,
      /runtime is not prepared/
    );

    /*
     * Generation continues to use the persistent
     * process-owned objects rather than constructing
     * new models per request.
     */
    assert.match(
      generateBlock,
      /self\._muq[\s\S]*?\.to\s*\(\s*["']cuda["']\s*\)/
    );

    assert.match(
      generateBlock,
      /self\._cfm[\s\S]*?\.to\s*\(\s*["']cuda["']\s*\)/
    );

    assert.match(
      generateBlock,
      /self\._vae[\s\S]*?\.to\s*\(\s*["']cuda["']\s*\)/
    );

    assert.doesNotMatch(
      generateBlock,
      /MuQMuLan\.from_pretrained/
    );

    assert.doesNotMatch(
      generateBlock,
      /load_checkpoint\s*\(/
    );

    assert.doesNotMatch(
      generateBlock,
      /torch\.jit\.load\s*\(/
    );
  }
);

test(
  'DiffRhythm E2 backend recognizes resident provider ownership and Base runtime identity',
  () => {
    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const service =
      read(
        'apps/backend/src/music-runtime/music-runtime.service.ts'
      );

    /*
     * E1 qualified the runtime itself. E2 makes the
     * backend aware that this provider is now a real
     * installed runtime with an owned container/image.
     *
     * This does NOT yet expose the Base model to user
     * selection.
     */
    const providerDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      providerDefinition,
      'DiffRhythm provider definition must exist'
    );

    assert.match(
      providerDefinition,
      /runtimeInstalled:\s*true/,
      'DiffRhythm provider runtime must be installed for ownership recovery'
    );

    assert.match(
      providerDefinition,
      /imageName:\s*'harmonia\/diffrhythm:dev'/
    );

    assert.match(
      providerDefinition,
      /dockerService:\s*'diffrhythm'/
    );

    assert.match(
      providerDefinition,
      /containerName:\s*'harmonia-diffrhythm'/
    );

    assert.match(
      providerDefinition,
      /composeProfile:\s*'model-diffrhythm'/
    );

    /*
     * Backend recovery maps provider health.model to
     * MUSIC_MODELS.runtimeModelId. Therefore Base must
     * declare the exact value returned by /health.
     */
    const modelDefinition =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      modelDefinition,
      'DiffRhythm Base definition must exist'
    );

    assert.match(
      modelDefinition,
      /runtimeModelId:\s*'diffrhythm-v12-base'/,
      'DiffRhythm Base must expose its provider runtime model id'
    );

    /*
     * E2 is ownership/recovery only.
     * User selection remains deliberately disabled
     * until backend generation/job qualification.
     */
    assert.match(
      modelDefinition,
      /availability:\s*'installed'/,
      'DiffRhythm Base must remain catalog-consistent after promotion'
    );

    /*
     * Runtime ownership recovery must query the
     * DiffRhythm provider's internal /health endpoint.
     */
    const recoveryStart =
      service.indexOf(
        'private async recoverProviderRuntimeSnapshot'
      );

    const reconcileStart =
      service.indexOf(
        'private async reconcileRuntimeOwnership',
        recoveryStart
      );

    assert.ok(
      recoveryStart >= 0,
      'recoverProviderRuntimeSnapshot must exist'
    );

    assert.ok(
      reconcileStart > recoveryStart,
      'reconcileRuntimeOwnership must follow snapshot recovery'
    );

    const recovery =
      service.slice(
        recoveryStart,
        reconcileStart
      );

    assert.match(
      recovery,
      /provider\.id\s*===\s*'diffrhythm'[\s\S]{0,160}\?\s*8767/,
      'DiffRhythm ownership recovery must query health port 8767'
    );

    assert.match(
      recovery,
      /snapshot\.model/
    );

    assert.match(
      recovery,
      /candidate\.providerId\s*===\s*provider\.id/
    );

    assert.match(
      recovery,
      /candidate\.runtimeModelId\s*===\s*snapshot\.model/
    );

    assert.match(
      recovery,
      /busy:\s*Boolean\(snapshot\.busy\)/
    );

    /*
     * The generic runtime ownership loop must include
     * installed providers with container/service metadata.
     */
    const reconcile =
      service.slice(
        reconcileStart
      );

    assert.match(
      reconcile,
      /provider\.runtimeInstalled/
    );

    assert.match(
      reconcile,
      /provider\.containerName/
    );

    assert.match(
      reconcile,
      /provider\.dockerService/
    );

    /*
     * Do not create a DiffRhythm-specific ownership
     * bypass. It participates in the same single-GPU
     * arbitration used by other persistent providers.
     */
    assert.doesNotMatch(
      reconcile,
      /diffrhythm[\s\S]{0,120}skip/i
    );
  }
);

test(
  'DiffRhythm E3 backend jobs use the resident provider with lyric-conditioned 95-second generation',
  () => {
    const jobs =
      read(
        'apps/backend/src/jobs/jobs.service.ts'
      );

    const dockerfile =
      read(
        'Dockerfile.diffrhythm'
      );

    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const clientPath =
      path.join(
        root,
        'scripts/diffrhythm_provider_client.py'
      );

    /*
     * Limit assertions to the actual persistent job
     * execution method so E2 recovery references do
     * not accidentally satisfy this contract.
     */
    const processStart =
      jobs.indexOf(
        'async processGenerationJob('
      );

    const validationStart =
      jobs.indexOf(
        'private validateGenerationRequest',
        processStart
      );

    assert.ok(
      processStart >= 0,
      'processGenerationJob must exist'
    );

    assert.ok(
      validationStart > processStart,
      'generation validation must follow job execution'
    );

    const processBlock =
      jobs.slice(
        processStart,
        validationStart
      );

    /*
     * DiffRhythm becomes an implemented backend job
     * provider, but still participates in the existing
     * queued/persistent generation lifecycle.
     */
    assert.match(
      processBlock,
      /'diffrhythm'/
    );

    assert.match(
      processBlock,
      /musicRuntime\.selectModel\s*\(\s*model\.id\s*\)/
    );

    assert.match(
      processBlock,
      /musicRuntime\.beginGeneration\s*\(\s*model\.providerId\s*\)/
    );

    assert.match(
      processBlock,
      /musicRuntime\.finishGeneration\s*\(\s*model\.providerId\s*\)/
    );

    /*
     * DiffRhythm writes the same durable per-job WAV
     * location used by the other providers.
     */
    assert.match(
      processBlock,
      /exports['"],\s*['"]jobs['"],\s*jobId/
    );

    assert.match(
      processBlock,
      /\/workspace\/exports\/jobs\/\$\{jobId\}\/music\.wav/
    );

    /*
     * DiffRhythm generation must preserve the two
     * conditioning inputs qualified in E1:
     *
     *   prompt/style
     *   timestamped lyrics
     */
    assert.match(
      processBlock,
      /model\.providerId\s*===\s*'diffrhythm'/
    );

    assert.match(
      processBlock,
      /parameters\[['"]lyrics['"]\]/
    );

    assert.match(
      processBlock,
      /runDiffRhythmClient\s*\(/
    );

    assert.match(
      processBlock,
      /runtimeModelId:\s*runtime\.runtimeModelId/
    );

    assert.match(
      processBlock,
      /prompt/
    );

    assert.match(
      processBlock,
      /lyrics/
    );

    assert.match(
      processBlock,
      /duration/
    );

    assert.match(
      processBlock,
      /outputPath:\s*containerPath/
    );

    /*
     * Durable job metadata must retain the actual
     * provider request/result context.
     */
    assert.match(
      processBlock,
      /diffrhythm/i
    );

    assert.match(
      processBlock,
      /requestedDurationSeconds/
    );

    /*
     * Request validation:
     * Base is the fixed 95-second / 2048-frame model.
     */
    const validationEnd =
      jobs.indexOf(
        'private parseDiffSingerScore',
        validationStart
      );

    assert.ok(
      validationEnd > validationStart,
      'validation block end not found'
    );

    const validation =
      jobs.slice(
        validationStart,
        validationEnd
      );

    assert.match(
      validation,
      /'diffrhythm'/
    );

    assert.match(
      validation,
      /model\.providerId\s*===\s*'diffrhythm'/
    );

    assert.match(
      validation,
      /95/
    );

    assert.match(
      validation,
      /lyrics/
    );

    assert.match(
      validation,
      /DiffRhythm/
    );

    /*
     * The job layer must reject arbitrary Base
     * durations rather than silently coercing them.
     */
    assert.match(
      validation,
      /duration[\s\S]*?!==\s*95|duration[\s\S]*?!=\s*95/
    );

    /*
     * A small container-side HTTP client keeps HTTP
     * details out of JobsService and talks only to
     * the resident provider's loopback endpoint.
     */
    assert.equal(
      existsSync(clientPath),
      true,
      'E3 must provide a DiffRhythm provider client'
    );

    const client =
      read(
        'scripts/diffrhythm_provider_client.py'
      );

    assert.match(
      client,
      /127\.0\.0\.1:8767\/generate/
    );

    assert.match(
      client,
      /urllib\.request/
    );

    assert.match(
      client,
      /"model"/
    );

    assert.match(
      client,
      /"prompt"/
    );

    assert.match(
      client,
      /"lyrics"/
    );

    assert.match(
      client,
      /"duration"/
    );

    assert.match(
      client,
      /"output"/
    );

    assert.match(
      client,
      /"seed"/
    );

    assert.match(
      client,
      /json\.loads|json\.load/
    );

    /*
     * JobsService invokes the client inside the
     * already-running provider container.
     */
    assert.match(
      jobs,
      /harmonia-diffrhythm/
    );

    assert.match(
      jobs,
      /\/workspace\/scripts\/diffrhythm_provider_client\.py/
    );

    /*
     * The image must contain that client.
     */
    assert.match(
      dockerfile,
      /COPY\s+scripts\/diffrhythm_provider_client\.py[\s\S]*?\/workspace\/scripts\/diffrhythm_provider_client\.py/
    );

    assert.match(
      dockerfile,
      /chmod\s+\+x[\s\S]*?diffrhythm_provider_client\.py/
    );

    /*
     * E3 code integration still does not expose Base.
     * Live end-to-end qualification precedes catalog
     * availability promotion.
     */
    const baseModel =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      baseModel,
      'DiffRhythm Base catalog entry must exist'
    );

    assert.match(
      baseModel,
      /runtimeModelId:\s*'diffrhythm-v12-base'/
    );

    assert.match(
      baseModel,
      /availability:\s*'installed'/
    );
  }
);

test(
  'DiffRhythm E3C promotes verified Base and qualifies authenticated durable backend generation',
  () => {
    const catalog =
      read(
        'apps/backend/src/music-runtime/music-model.catalog.ts'
      );

    const pkg =
      JSON.parse(
        read(
          'package.json'
        )
      );

    const qualifierPath =
      path.join(
        root,
        'scripts/qualify-diffrhythm-job.cjs'
      );

    const qualifier =
      read(
        'scripts/qualify-diffrhythm-job.cjs'
      );

    const cases =
      read(
        'tests/model-qualification/model-generation-cases.cjs'
      );

    const registry =
      read(
        'inventory/model_registry.json'
      );

    const base =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-base',[\s\S]*?\n\s*\},/
      )?.[0];

    const full =
      catalog.match(
        /\{\s*id:\s*'diffrhythm-v12-full',[\s\S]*?\n\s*\},/
      )?.[0];

    assert.ok(
      base
    );

    assert.ok(
      full
    );

    assert.match(
      base,
      /availability:\s*'installed'/
    );

    assert.match(
      base,
      /runtimeModelId:\s*'diffrhythm-v12-base'/
    );

    assert.match(
      full,
      /availability:\s*'planned'/
    );

    assert.equal(
      existsSync(
        qualifierPath
      ),
      true
    );

    assert.equal(
      pkg.scripts[
        'qualify:diffrhythm-job'
      ],
      'node scripts/qualify-diffrhythm-job.cjs'
    );

    assert.match(
      pkg.scripts[
        'lint:scripts'
      ],
      /qualify-diffrhythm-job\.cjs/
    );

    assert.match(
      qualifier,
      /authenticateQualificationUser/
    );

    assert.match(
      qualifier,
      /selectRuntimeModel/
    );

    assert.match(
      qualifier,
      /expectedProviderId:[\s\S]*?'diffrhythm'/
    );

    assert.match(
      qualifier,
      /\/api\/jobs/
    );

    assert.match(
      qualifier,
      /\/api\/jobs\/\$\{jobId\}\/artifact/
    );

    assert.match(
      qualifier,
      /requestedDuration[\s\S]*95/
    );

    assert.match(
      qualifier,
      /channels[\s\S]*2/
    );

    assert.match(
      qualifier,
      /44100/
    );

    assert.match(
      qualifier,
      /bitsPerSample[\s\S]*16/
    );

    assert.match(
      qualifier,
      /audioFormat[\s\S]*1/
    );

    assert.match(
      qualifier,
      /backendHash/
    );

    assert.match(
      qualifier,
      /frontendHash/
    );

    assert.match(
      qualifier,
      /DIFFRHYTHM_BACKEND_JOB_QUALIFICATION_OK/
    );

    assert.match(
      cases,
      /id:\s*'diffrhythm-northern-transmission'/
    );

    assert.match(
      cases,
      /id:\s*'diffrhythm-midnight-current'/
    );

    assert.match(
      cases,
      /modelId:\s*'diffrhythm-v12-base'/
    );

    for (
      const artifactId of [
        'diffrhythm-v12-base-core',
        'diffrhythm-vae',
        'diffrhythm-muq-mulan',
        'diffrhythm-muq-audio',
        'diffrhythm-xlm-roberta',
      ]
    ) {
      assert.match(
        registry,
        new RegExp(
          artifactId
        )
      );
    }
  }
);
