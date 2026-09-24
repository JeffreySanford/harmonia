#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'inventory', 'model_registry.json');
const schemaPath = path.join(root, 'inventory', 'model_registry.schema.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

  return !(
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  console.log('============================================================');
  console.log(' HARMONIA MODEL REGISTRY - PHASE 1 QUALIFICATION');
  console.log('============================================================');

  const registry = readJson(registryPath);
  const schema = readJson(schemaPath);

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });

  const validate = ajv.compile(schema);
  const valid = validate(registry);

  if (!valid) {
    throw new Error(
      'Registry failed JSON Schema validation:\n' +
        JSON.stringify(validate.errors, null, 2)
    );
  }

  console.log('JSON Schema validation = passed');

  assert(
    isSafeRelativePath(registry.modelsRoot),
    'modelsRoot must be relative and traversal-free'
  );

  for (const artifact of registry.artifacts) {
    assert(
      isSafeRelativePath(artifact.destination),
      `unsafe artifact destination: ${artifact.artifactId}`
    );

    if (artifact.source?.url) {
      const parsed = new URL(artifact.source.url);
      assert(
        parsed.protocol === 'https:',
        `artifact source URL must use HTTPS: ${artifact.artifactId}`
      );
    }

    if (artifact.license?.sourceUrl) {
      const parsed = new URL(artifact.license.sourceUrl);
      assert(
        ['https:', 'http:'].includes(parsed.protocol),
        `invalid license source URL: ${artifact.artifactId}`
      );
    }
  }

  console.log('Filesystem path safety = passed');
  console.log('Source/license URL validation = passed');

  const forbiddenField =
    /(?:^|_)(?:token|api[_-]?key|secret|password|credential)(?:$|_)/i;
  const forbiddenValues = [
    /hf_[A-Za-z0-9]{10,}/,
    /Bearer\s+[A-Za-z0-9._~+\/-]+/i,
    /(?:api[_-]?key|token|secret|password)\s*[=:]\s*[^\s"']+/i,
  ];

  walk(registry, (key, value, fieldPath) => {
    assert(
      forbiddenField.test(key) === false,
      `secret-like field is forbidden: ${fieldPath.join('.')}`
    );

    if (typeof value !== 'string') {
      return;
    }

    for (const pattern of forbiddenValues) {
      assert(
        pattern.test(value) === false,
        `secret-like value is forbidden: ${fieldPath.join('.')}`
      );
    }
  });

  console.log('Secret field/value scan = passed');

  const stable = registry.artifacts.find(
    (entry) => entry.artifactId === 'stable-audio-3-small-music'
  );

  assert(stable, 'Stable Audio 3 Small-Music artifact is missing');
  assert(
    stable.source.repoId ===
      'stabilityai/stable-audio-3-small-music',
    'Stable Audio 3 repoId is incorrect'
  );
  assert(
    stable.source.revision ===
      '0fef1392cd842149a2b6d445e181c97608faac06',
    'Stable Audio 3 qualified snapshot is not pinned'
  );
  assert(stable.source.gated === true, 'Stable Audio 3 must remain gated');
  assert(
    stable.license.acceptanceRequired === true,
    'Stable Audio 3 must declare license acceptance'
  );

  console.log('Stable Audio qualified snapshot pin = passed');

  const diffsinger = registry.modelBindings.find(
    (entry) => entry.modelId === 'diffsinger-acoustic-hifigan'
  );

  assert(diffsinger, 'DiffSinger model binding is missing');
  assert(
    JSON.stringify(diffsinger.artifactIds) ===
      JSON.stringify([
        'diffsinger-opencpop-acoustic',
        'diffsinger-xiaoma-pitch-estimator',
        'diffsinger-hifigan-vocoder',
      ]),
    'DiffSinger composite artifact binding is incomplete'
  );

  console.log('DiffSinger composite binding = passed');

  const defaultArtifacts = registry.artifacts.filter(
    (artifact) => artifact.defaultInstall === true
  );
  const optionalArtifacts = registry.artifacts.filter(
    (artifact) => artifact.defaultInstall === false
  );

  console.log('');
  console.log(`schemaVersion            = ${registry.schemaVersion}`);
  console.log(`modelsRoot               = ${registry.modelsRoot}`);
  console.log(`artifacts                = ${registry.artifacts.length}`);
  console.log(`modelBindings            = ${registry.modelBindings.length}`);
  console.log(`defaultInstallArtifacts  = ${defaultArtifacts.length}`);
  console.log(`optionalArtifacts        = ${optionalArtifacts.length}`);
  console.log('');
  console.log('MODEL_REGISTRY_PHASE_1_QUALIFICATION_OK');
}

try {
  main();
} catch (error) {
  console.error('');
  console.error('MODEL_REGISTRY_PHASE_1_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}
