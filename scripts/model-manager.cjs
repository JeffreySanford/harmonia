#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const Ajv = require('ajv');

const repoRoot = path.resolve(__dirname, '..');
const registryPath = path.join(repoRoot, 'inventory', 'model_registry.json');
const schemaPath = path.join(repoRoot, 'inventory', 'model_registry.schema.json');
const RESULT_SCHEMA_VERSION = 'harmonia-model-manager-result-v1';

function fail(message, code = 2) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadRegistry() {
  const registry = readJson(registryPath);
  const schema = readJson(schemaPath);
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  const validate = ajv.compile(schema);

  if (!validate(registry)) {
    fail(
      'Model registry failed schema validation:\n' +
        JSON.stringify(validate.errors, null, 2)
    );
  }

  return registry;
}

function parseArgs(argv) {
  const args = {
    command: null,
    modelIds: [],
    providerIds: [],
    artifactIds: [],
    root: null,
    offline: false,
    dryRun: false,
    json: false,
    requireDb: false,
    force: false,
    verbose: false,
  };

  const values = [...argv];
  args.command = values.shift() || null;

  while (values.length > 0) {
    const token = values.shift();

    switch (token) {
      case '--model':
        if (!values[0] || values[0].startsWith('--')) {
          fail('--model requires a modelId');
        }
        args.modelIds.push(values.shift());
        break;
      case '--provider':
        if (!values[0] || values[0].startsWith('--')) {
          fail('--provider requires a providerId');
        }
        args.providerIds.push(values.shift());
        break;
      case '--artifact':
        if (!values[0] || values[0].startsWith('--')) {
          fail('--artifact requires an artifactId');
        }
        args.artifactIds.push(values.shift());
        break;
      case '--root':
        if (!values[0] || values[0].startsWith('--')) {
          fail('--root requires a path');
        }
        args.root = values.shift();
        break;
      case '--offline':
        args.offline = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--require-db':
        args.requireDb = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--help':
      case '-h':
        args.command = 'help';
        break;
      default:
        fail('Unknown argument: ' + token);
    }
  }

  return args;
}

function usage() {
  return [
    'Harmonia model manager',
    '',
    'Usage:',
    '  node scripts/model-manager.cjs plan [options]',
    '',
    'Implemented in the current phase:',
    '  plan       Inspect registry + local cache; never downloads or repairs.',
    '',
    'Planned commands:',
    '  init       Rehydrate missing artifacts.',
    '  verify     Deep local verification.',
    '  inventory  Emit normalized observed inventory.',
    '  repair     Conservatively repair incomplete artifacts.',
    '',
    'Options:',
    '  --model <modelId>',
    '  --provider <providerId>',
    '  --artifact <artifactId>',
    '  --root <path>',
    '  --offline',
    '  --dry-run',
    '  --json',
    '  --require-db',
    '  --force',
    '  --verbose',
  ].join('\n');
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

function safeResolveUnderRoot(rootPath, relativePath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  ) {
    fail('Artifact destination escapes model root: ' + relativePath);
  }

  return resolvedTarget;
}

function readLocalEnv() {
  const envFile = path.join(repoRoot, '.env');

  if (!fs.existsSync(envFile)) {
    return {};
  }

  try {
    return parseEnv(fs.readFileSync(envFile, 'utf8'));
  } catch {
    return {};
  }
}

function hasHuggingFaceCredential(env = readLocalEnv()) {
  return Boolean(
    process.env.HF_TOKEN ||
      env.HF_TOKEN ||
      process.env.HUGGINGFACE_API_KEY ||
      env.HUGGINGFACE_API_KEY ||
      process.env.HUGGING_FACE_HUB_TOKEN ||
      env.HUGGING_FACE_HUB_TOKEN ||
      process.env.HUGGINGFACE_HUB_TOKEN ||
      env.HUGGINGFACE_HUB_TOKEN
  );
}

function listFilesRecursive(directory, prefix = '') {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;

    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolute, relative));
    } else {
      files.push(relative.replace(/\\/g, '/'));
    }
  }

  return files;
}

function wildcardToRegExp(pattern) {
  const regexSpecialCharacters = '\\\\.\^\$\+\{\}\(\)\|\[\]';
  const escaped = pattern
    .split('')
    .map((character) => {
      if (character === '*') return '.*';
      if (character === '?') return '.';
      return regexSpecialCharacters.includes(character)
        ? '\\\\' + character
        : character;
    })
    .join('');

  return new RegExp('^' + escaped + '$');
}

function inspectCheckpointArtifact(artifact, artifactRoot) {
  if (!fs.existsSync(artifactRoot)) {
    return {
      state: 'missing',
      resolvedRevision: null,
      detail: 'artifact directory is absent',
    };
  }

  const requiredMissing = (artifact.verification.requiredFiles || []).filter(
    (relativePath) => !fs.existsSync(path.join(artifactRoot, relativePath))
  );

  const allFiles = listFilesRecursive(artifactRoot);
  const missingGlobs = (artifact.verification.checkpointGlobs || []).filter(
    (pattern) => {
      const matcher = wildcardToRegExp(pattern);
      return !allFiles.some((relativePath) => {
        const basename = path.posix.basename(relativePath);
        return matcher.test(relativePath) || matcher.test(basename);
      });
    }
  );

  if (requiredMissing.length > 0 || missingGlobs.length > 0) {
    return {
      state: 'degraded',
      resolvedRevision: artifact.source.revision || null,
      detail: [
        requiredMissing.length
          ? 'missing files: ' + requiredMissing.join(', ')
          : null,
        missingGlobs.length
          ? 'missing checkpoint patterns: ' + missingGlobs.join(', ')
          : null,
      ]
        .filter(Boolean)
        .join('; '),
    };
  }

  return {
    state: 'verified',
    resolvedRevision: artifact.source.revision || null,
    detail: 'required config/checkpoint markers are present',
  };
}

function huggingFaceRepoCacheRoot(artifactRoot, repoId) {
  const cacheName = 'models--' + repoId.replace(/\//g, '--');
  return path.join(artifactRoot, 'hub', cacheName);
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8').trim() || null;
}

function listSnapshotRevisions(repoCacheRoot) {
  const snapshotsRoot = path.join(repoCacheRoot, 'snapshots');

  if (!fs.existsSync(snapshotsRoot)) {
    return [];
  }

  return fs
    .readdirSync(snapshotsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function inspectHuggingFaceArtifact(artifact, artifactRoot) {
  const repoId = artifact.source.repoId;
  const repoCacheRoot = huggingFaceRepoCacheRoot(artifactRoot, repoId);

  if (!fs.existsSync(repoCacheRoot)) {
    return {
      state: 'missing',
      resolvedRevision: null,
      detail: 'Hugging Face cache is absent for ' + repoId,
    };
  }

  const expectedRevision = artifact.source.revision || null;
  const mainRevision = readTextIfExists(path.join(repoCacheRoot, 'refs', 'main'));
  const snapshots = listSnapshotRevisions(repoCacheRoot);

  let resolvedRevision = null;

  if (
    expectedRevision &&
    fs.existsSync(path.join(repoCacheRoot, 'snapshots', expectedRevision))
  ) {
    resolvedRevision = expectedRevision;
  } else if (
    mainRevision &&
    fs.existsSync(path.join(repoCacheRoot, 'snapshots', mainRevision))
  ) {
    resolvedRevision = mainRevision;
  } else if (snapshots.length > 0) {
    resolvedRevision = snapshots[snapshots.length - 1];
  }

  if (!resolvedRevision) {
    return {
      state: 'degraded',
      resolvedRevision: null,
      detail: 'repository cache exists but no complete snapshot directory was found',
    };
  }

  if (expectedRevision && resolvedRevision !== expectedRevision) {
    return {
      state: 'revision-mismatch',
      resolvedRevision,
      detail:
        'expected snapshot ' +
        expectedRevision +
        ' but found ' +
        resolvedRevision,
    };
  }

  const snapshotRoot = path.join(repoCacheRoot, 'snapshots', resolvedRevision);
  const requiredMissing = (artifact.verification.requiredFiles || []).filter(
    (relativePath) => !fs.existsSync(path.join(snapshotRoot, relativePath))
  );

  if (requiredMissing.length > 0) {
    return {
      state: 'degraded',
      resolvedRevision,
      detail:
        'snapshot is missing required files: ' + requiredMissing.join(', '),
    };
  }

  return {
    state: 'verified',
    resolvedRevision,
    detail:
      'snapshot ' + resolvedRevision + ' contains required files',
  };
}

function inspectArtifact(artifact, modelRoot, auth) {
  const artifactRoot = safeResolveUnderRoot(modelRoot, artifact.destination);
  let inspection;

  switch (artifact.verification.strategy) {
    case 'huggingface-snapshot':
      inspection = inspectHuggingFaceArtifact(artifact, artifactRoot);
      break;
    case 'checkpoint-config-pair':
    case 'required-files':
      inspection = inspectCheckpointArtifact(artifact, artifactRoot);
      break;
    default:
      inspection = {
        state: 'unknown',
        resolvedRevision: null,
        detail:
          'verification strategy not implemented by plan: ' +
          artifact.verification.strategy,
      };
      break;
  }

  return {
    ...inspection,
    auth:
      artifact.source.kind !== 'huggingface' || !artifact.source.gated
        ? 'not-required'
        : auth.huggingFace
          ? 'present'
          : 'missing',
  };
}

function validateSelectors(registry, options) {
  const knownModels = new Set(
    registry.modelBindings.map((binding) => binding.modelId)
  );
  const knownProviders = new Set(
    registry.artifacts.map((artifact) => artifact.providerId)
  );
  const knownArtifacts = new Set(
    registry.artifacts.map((artifact) => artifact.artifactId)
  );

  for (const modelId of options.modelIds) {
    if (!knownModels.has(modelId)) {
      fail('Unknown model selector: ' + modelId);
    }
  }

  for (const providerId of options.providerIds) {
    if (!knownProviders.has(providerId)) {
      fail('Unknown provider selector: ' + providerId);
    }
  }

  for (const artifactId of options.artifactIds) {
    if (!knownArtifacts.has(artifactId)) {
      fail('Unknown artifact selector: ' + artifactId);
    }
  }
}

function selectBindings(registry, options) {
  validateSelectors(registry, options);

  let bindings = registry.modelBindings.map((binding) => ({ ...binding }));

  if (options.modelIds.length > 0) {
    const selected = new Set(options.modelIds);
    bindings = bindings.filter((binding) => selected.has(binding.modelId));
  }

  if (options.providerIds.length > 0) {
    const providers = new Set(options.providerIds);
    const artifactById = new Map(
      registry.artifacts.map((artifact) => [artifact.artifactId, artifact])
    );

    bindings = bindings.filter((binding) =>
      binding.artifactIds.some((artifactId) =>
        providers.has(artifactById.get(artifactId)?.providerId)
      )
    );
  }

  if (options.artifactIds.length > 0) {
    const selectedArtifacts = new Set(options.artifactIds);
    bindings = bindings.filter((binding) =>
      binding.artifactIds.some((artifactId) =>
        selectedArtifacts.has(artifactId)
      )
    );
  }

  return bindings;
}

function selectArtifacts(registry, bindings, options) {
  const artifactById = new Map(
    registry.artifacts.map((artifact) => [artifact.artifactId, artifact])
  );
  const artifactIds = new Set();

  for (const binding of bindings) {
    for (const artifactId of binding.artifactIds) {
      artifactIds.add(artifactId);
    }
  }

  if (options.artifactIds.length > 0) {
    const selected = new Set(options.artifactIds);

    for (const artifactId of [...artifactIds]) {
      if (!selected.has(artifactId)) {
        artifactIds.delete(artifactId);
      }
    }
  }

  return [...artifactIds].map((artifactId) => artifactById.get(artifactId));
}

function modelIdsForArtifact(registry, artifactId) {
  return registry.modelBindings
    .filter((binding) => binding.artifactIds.includes(artifactId))
    .map((binding) => binding.modelId);
}

function deriveAction(artifact, inspection, explicitlySelected) {
  if (!artifact.defaultInstall && !explicitlySelected) {
    return 'skipped-default';
  }

  if (inspection.state === 'verified') {
    return 'none';
  }

  if (
    artifact.source.gated &&
    inspection.auth === 'missing' &&
    inspection.state !== 'verified'
  ) {
    return 'authenticate';
  }

  switch (inspection.state) {
    case 'missing':
      return 'download';
    case 'degraded':
      return 'repair';
    case 'revision-mismatch':
      return 'review-revision';
    default:
      return 'inspect';
  }
}

function deriveModelState(binding, artifactRows) {
  const rows = binding.artifactIds
    .map((artifactId) =>
      artifactRows.find((row) => row.artifactId === artifactId)
    )
    .filter(Boolean);

  if (rows.length !== binding.artifactIds.length) {
    return 'unknown';
  }

  if (rows.every((row) => row.state === 'verified')) {
    return 'verified';
  }

  if (rows.some((row) => row.state === 'revision-mismatch')) {
    return 'revision-mismatch';
  }

  if (rows.some((row) => row.state === 'degraded')) {
    return 'degraded';
  }

  if (rows.some((row) => row.state === 'missing')) {
    return 'missing';
  }

  return 'unknown';
}

function createPlan(options = {}) {
  const registry = loadRegistry();
  const normalized = {
    command: 'plan',
    modelIds: options.modelIds || [],
    providerIds: options.providerIds || [],
    artifactIds: options.artifactIds || [],
    root: options.root || registry.modelsRoot,
    offline: Boolean(options.offline),
    dryRun: Boolean(options.dryRun),
    json: Boolean(options.json),
    requireDb: Boolean(options.requireDb),
    force: Boolean(options.force),
    verbose: Boolean(options.verbose),
  };

  const modelRoot = path.isAbsolute(normalized.root)
    ? normalized.root
    : path.resolve(repoRoot, normalized.root);

  const bindings = selectBindings(registry, normalized);
  const artifacts = selectArtifacts(registry, bindings, normalized);

  if (bindings.length === 0 || artifacts.length === 0) {
    fail('Selectors resolved to no model artifacts.');
  }

  const explicitSelection =
    normalized.modelIds.length > 0 ||
    normalized.providerIds.length > 0 ||
    normalized.artifactIds.length > 0;

  const auth =
    options.auth ||
    {
      huggingFace: hasHuggingFaceCredential(),
    };

  const artifactRows = artifacts.map((artifact) => {
    const inspection = inspectArtifact(artifact, modelRoot, auth);
    const directArtifact = normalized.artifactIds.includes(artifact.artifactId);
    const directModel = normalized.modelIds.some((modelId) => {
      const binding = registry.modelBindings.find(
        (candidate) => candidate.modelId === modelId
      );
      return binding?.artifactIds.includes(artifact.artifactId);
    });
    const directProvider =
      explicitSelection &&
      normalized.providerIds.includes(artifact.providerId);

    return {
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      modelIds: modelIdsForArtifact(registry, artifact.artifactId),
      runtimeModelIds: artifact.runtimeModelIds,
      sourceKind: artifact.source.kind,
      sourceRef: artifact.source.repoId || artifact.source.url,
      expectedRevision: artifact.source.revision || null,
      resolvedRevision: inspection.resolvedRevision,
      relativePath: artifact.destination,
      verificationStrategy: artifact.verification.strategy,
      gated: Boolean(artifact.source.gated),
      authentication: inspection.auth,
      defaultInstall: Boolean(artifact.defaultInstall),
      state: inspection.state,
      action: deriveAction(
        artifact,
        inspection,
        directArtifact || directModel || directProvider
      ),
      detail: inspection.detail,
    };
  });

  const modelRows = bindings.map((binding) => {
    const relevant = artifactRows.filter((row) =>
      binding.artifactIds.includes(row.artifactId)
    );

    return {
      modelId: binding.modelId,
      artifactIds: binding.artifactIds,
      state: deriveModelState(binding, artifactRows),
      actions: [...new Set(relevant.map((row) => row.action))],
    };
  });

  const summary = {
    selectedModels: modelRows.length,
    selectedArtifacts: artifactRows.length,
    verified: artifactRows.filter((row) => row.state === 'verified').length,
    missing: artifactRows.filter((row) => row.state === 'missing').length,
    degraded: artifactRows.filter((row) => row.state === 'degraded').length,
    revisionMismatch: artifactRows.filter(
      (row) => row.state === 'revision-mismatch'
    ).length,
    unknown: artifactRows.filter((row) => row.state === 'unknown').length,
    downloadsRequired: artifactRows.filter(
      (row) => row.action === 'download'
    ).length,
    repairsRequired: artifactRows.filter(
      (row) => row.action === 'repair'
    ).length,
    authenticationRequired: artifactRows.filter(
      (row) => row.action === 'authenticate'
    ).length,
    defaultSkipped: artifactRows.filter(
      (row) => row.action === 'skipped-default'
    ).length,
  };

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    command: 'plan',
    ok: true,
    modelsRoot: normalized.root.replace(/\\/g, '/'),
    offline: normalized.offline,
    dryRun: normalized.dryRun,
    databaseIntegration: 'not-yet-implemented',
    summary,
    models: modelRows,
    artifacts: artifactRows,
    warnings: [
      'Phase 2 plan is filesystem/registry read-only; Mongo installation-state reconciliation is not implemented yet.',
      'Plan does not perform remote access, download, repair, or provider startup.',
    ],
  };
}

function writeReport(result) {
  const reportDir = path.join(repoRoot, 'generated', 'model-manager');
  fs.mkdirSync(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, timestamp + '-plan.json');

  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  return path.relative(repoRoot, reportPath).replace(/\\/g, '/');
}

function printHumanPlan(result, reportPath) {
  const widths = {
    model: 33,
    artifact: 38,
    state: 18,
    action: 18,
  };

  const pad = (value, width) => {
    const text = String(value ?? '');
    return text.length >= width
      ? text.slice(0, width - 1) + '…'
      : text.padEnd(width);
  };

  console.log('============================================================');
  console.log(' HARMONIA MODEL PLAN');
  console.log('============================================================');
  console.log('modelsRoot: ' + result.modelsRoot);
  console.log('network: no remote requests');
  console.log('mutation: none');
  console.log('');

  console.log(
    [
      pad('MODEL', widths.model),
      pad('ARTIFACT', widths.artifact),
      pad('STATE', widths.state),
      pad('ACTION', widths.action),
    ].join(' ')
  );

  console.log(
    [
      '-'.repeat(widths.model),
      '-'.repeat(widths.artifact),
      '-'.repeat(widths.state),
      '-'.repeat(widths.action),
    ].join(' ')
  );

  for (const row of result.artifacts) {
    console.log(
      [
        pad(row.modelIds.join(','), widths.model),
        pad(row.artifactId, widths.artifact),
        pad(row.state, widths.state),
        pad(row.action, widths.action),
      ].join(' ')
    );

    if (row.gated) {
      console.log(
        '  gated=yes auth=' +
          row.authentication +
          ' revision=' +
          (row.expectedRevision || 'unpinned')
      );
    } else if (row.expectedRevision || row.resolvedRevision) {
      console.log(
        '  revision expected=' +
          (row.expectedRevision || 'unpinned') +
          ' resolved=' +
          (row.resolvedRevision || 'none')
      );
    }

    if (row.detail) {
      console.log('  ' + row.detail);
    }
  }

  console.log('');
  console.log('SUMMARY');

  for (const [key, value] of Object.entries(result.summary)) {
    console.log(key + '=' + value);
  }

  console.log('');
  console.log('report=' + reportPath);
  console.log('MODEL_PLAN_OK');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (!args.command || args.command === 'help') {
    console.log(usage());
    return 0;
  }

  if (args.command !== 'plan') {
    fail(
      'Command "' +
        args.command +
        '" is not implemented yet. Phase 2 currently exposes read-only "plan" only.'
    );
  }

  const result = createPlan(args);
  const reportPath = writeReport(result);

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ...result,
          reportPath,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    printHumanPlan(result, reportPath);
  }

  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    const code = Number(error?.exitCode) || 1;
    const message =
      error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = code;
  }
}

module.exports = {
  createPlan,
  deriveAction,
  deriveModelState,
  hasHuggingFaceCredential,
  inspectArtifact,
  inspectCheckpointArtifact,
  inspectHuggingFaceArtifact,
  isSafeRelativePath,
  loadRegistry,
  parseArgs,
  safeResolveUnderRoot,
  selectArtifacts,
  selectBindings,
  wildcardToRegExp,
};
