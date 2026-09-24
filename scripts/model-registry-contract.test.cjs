const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function catalogModels() {
  const source = read(
    'apps/backend/src/music-runtime/music-model.catalog.ts'
  );
  const start = source.indexOf('export const MUSIC_MODELS');
  assert.notEqual(start, -1, 'MUSIC_MODELS catalog declaration is missing');

  const modelSource = source.slice(start);
  const blocks = modelSource.match(/\{[\s\S]*?\n  \},/g) || [];

  return blocks
    .map((block) => {
      const id = block.match(/\bid:\s*'([^']+)'/)?.[1];
      const providerId = block.match(/\bproviderId:\s*'([^']+)'/)?.[1];
      const runtimeModelId = block.match(
        /\bruntimeModelId:\s*'([^']+)'/
      )?.[1];
      const availability = block.match(
        /\bavailability:\s*'([^']+)'/
      )?.[1];

      return {
        id,
        providerId,
        runtimeModelId,
        availability,
      };
    })
    .filter((model) => model.id && model.providerId && model.availability);
}

function walk(value, visit, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, visit, [...pathParts, String(index)])
    );
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      visit(key, item, [...pathParts, key]);
      walk(item, visit, [...pathParts, key]);
    }
  }
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  const normalized = value.replace(/\\/g, '/');

  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    return false;
  }

  return true;
}

test('model registry uses the supported v1 schema and unique identities', () => {
  const registry = readJson('inventory/model_registry.json');
  const schema = readJson('inventory/model_registry.schema.json');

  assert.equal(registry.schemaVersion, 'harmonia-model-registry-v1');
  assert.equal(
    schema.properties.schemaVersion.const,
    'harmonia-model-registry-v1'
  );
  assert.equal(registry.modelsRoot, 'models');
  assert.ok(isSafeRelativePath(registry.modelsRoot));

  const artifactIds = registry.artifacts.map((artifact) => artifact.artifactId);
  const modelIds = registry.modelBindings.map((binding) => binding.modelId);

  assert.equal(new Set(artifactIds).size, artifactIds.length);
  assert.equal(new Set(modelIds).size, modelIds.length);
});

test('model registry contains no secret fields or absolute destinations', () => {
  const registry = readJson('inventory/model_registry.json');
  const secretField =
    /(?:^|_)(?:token|api[_-]?key|secret|password|credential)(?:$|_)/i;

  walk(registry, (key, _value, fieldPath) => {
    assert.equal(
      secretField.test(key),
      false,
      `secret-like registry field is forbidden: ${fieldPath.join('.')}`
    );
  });

  for (const artifact of registry.artifacts) {
    assert.ok(
      isSafeRelativePath(artifact.destination),
      `artifact destination must be relative and traversal-free: ${artifact.artifactId}`
    );
  }
});

test('model registry contains no secret-like values', () => {
  const registry = readJson('inventory/model_registry.json');
  const forbiddenValuePatterns = [
    /hf_[A-Za-z0-9]{10,}/,
    /Bearer\s+[A-Za-z0-9._~+\/-]+/i,
    /(?:api[_-]?key|token|secret|password)\s*[=:]\s*[^\s"']+/i,
  ];

  walk(registry, (_key, value, fieldPath) => {
    if (typeof value !== 'string') {
      return;
    }

    for (const pattern of forbiddenValuePatterns) {
      assert.equal(
        pattern.test(value),
        false,
        `secret-like registry value is forbidden: ${fieldPath.join('.')}`
      );
    }
  });
});

test('model registry source and verification contracts are complete', () => {
  const registry = readJson('inventory/model_registry.json');

  for (const artifact of registry.artifacts) {
    assert.ok(artifact.providerId);
    assert.ok(artifact.displayName);
    assert.ok(Array.isArray(artifact.runtimeModelIds));
    assert.ok(artifact.runtimeModelIds.length > 0);
    assert.ok(
      ['huggingface', 'http-zip'].includes(artifact.source.kind),
      `unsupported source kind for ${artifact.artifactId}`
    );

    if (artifact.source.kind === 'huggingface') {
      assert.ok(
        artifact.source.repoId,
        `Hugging Face artifact is missing repoId: ${artifact.artifactId}`
      );
    }

    if (artifact.source.kind === 'http-zip') {
      assert.match(
        artifact.source.url || '',
        /^https:\/\//,
        `HTTP ZIP artifact must use an HTTPS source: ${artifact.artifactId}`
      );
    }

    assert.ok(artifact.verification.strategy);
    assert.ok(Array.isArray(artifact.verification.requiredFiles));

    if (artifact.source.gated) {
      assert.equal(
        artifact.license.acceptanceRequired,
        true,
        `gated artifact must declare license acceptance: ${artifact.artifactId}`
      );
    }
  }
});

test('shared destinations are explicit and exclusive destinations never collide', () => {
  const registry = readJson('inventory/model_registry.json');
  const byDestination = new Map();

  for (const artifact of registry.artifacts) {
    const entries = byDestination.get(artifact.destination) || [];
    entries.push(artifact);
    byDestination.set(artifact.destination, entries);
  }

  for (const [destination, artifacts] of byDestination.entries()) {
    if (artifacts.length < 2) {
      continue;
    }

    assert.ok(
      artifacts.every((artifact) => artifact.sharedDestination === true),
      `duplicate destination requires sharedDestination=true: ${destination}`
    );
  }
});

test('every installed catalog model has a valid registry binding', () => {
  const registry = readJson('inventory/model_registry.json');
  const models = catalogModels();
  const artifacts = new Map(
    registry.artifacts.map((artifact) => [artifact.artifactId, artifact])
  );
  const bindings = new Map(
    registry.modelBindings.map((binding) => [binding.modelId, binding])
  );

  const installed = models.filter(
    (model) => model.availability === 'installed'
  );

  assert.ok(installed.length > 0);

  for (const model of installed) {
    const binding = bindings.get(model.id);

    assert.ok(
      binding,
      `installed catalog model has no registry binding: ${model.id}`
    );

    assert.ok(binding.artifactIds.length > 0);

    for (const artifactId of binding.artifactIds) {
      const artifact = artifacts.get(artifactId);

      assert.ok(
        artifact,
        `binding ${model.id} references unknown artifact ${artifactId}`
      );

      assert.equal(
        artifact.providerId,
        model.providerId,
        `artifact/provider mismatch for ${model.id}: ${artifactId}`
      );
    }
  }
});

test('every model binding points to a real catalog model and artifact', () => {
  const registry = readJson('inventory/model_registry.json');
  const models = new Map(catalogModels().map((model) => [model.id, model]));
  const artifacts = new Set(
    registry.artifacts.map((artifact) => artifact.artifactId)
  );

  for (const binding of registry.modelBindings) {
    assert.ok(
      models.has(binding.modelId),
      `registry binding references unknown catalog model: ${binding.modelId}`
    );

    for (const artifactId of binding.artifactIds) {
      assert.ok(
        artifacts.has(artifactId),
        `registry binding references unknown artifact: ${artifactId}`
      );
    }
  }
});

test('qualified composite and gated model contracts are represented explicitly', () => {
  const registry = readJson('inventory/model_registry.json');
  const bindings = new Map(
    registry.modelBindings.map((binding) => [binding.modelId, binding])
  );
  const artifacts = new Map(
    registry.artifacts.map((artifact) => [artifact.artifactId, artifact])
  );

  assert.deepEqual(
    bindings.get('diffsinger-acoustic-hifigan')?.artifactIds,
    [
      'diffsinger-opencpop-acoustic',
      'diffsinger-xiaoma-pitch-estimator',
      'diffsinger-hifigan-vocoder',
    ]
  );

  const stable = artifacts.get('stable-audio-3-small-music');
  assert.equal(stable?.source.kind, 'huggingface');
  assert.equal(
    stable?.source.repoId,
    'stabilityai/stable-audio-3-small-music'
  );
  assert.equal(stable?.source.gated, true);
  assert.equal(stable?.license.acceptanceRequired, true);
  assert.equal(stable?.defaultInstall, true);

  assert.equal(artifacts.get('musicgen-medium')?.defaultInstall, false);
  assert.equal(
    artifacts.get('musicgen-stereo-medium')?.defaultInstall,
    false
  );
});

test('package exposes the committed Phase 1 model registry qualifier', () => {
  const pkg = readJson('package.json');

  assert.equal(
    pkg.scripts['qualify:model-registry-phase1'],
    'node scripts/qualify-model-registry-phase1.cjs'
  );

  const qualifier = read('scripts/qualify-model-registry-phase1.cjs');

  assert.match(qualifier, /new Ajv/);
  assert.match(qualifier, /isSafeRelativePath/);
  assert.match(qualifier, /Stable Audio qualified snapshot pin = passed/);
  assert.match(qualifier, /DiffSinger composite binding = passed/);
  assert.match(qualifier, /MODEL_REGISTRY_PHASE_1_QUALIFICATION_OK/);
});
