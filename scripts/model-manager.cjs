#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
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
    '  node scripts/model-manager.cjs verify [options]',
    '',
    'Implemented:',
    '  plan       Inspect registry + local cache; never downloads or repairs.',
    '  verify     Deep read-only local verification.',
    '',
    'Planned commands:',
    '  init       Rehydrate missing artifacts.',
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
        ? '\\' + character
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

function inspectShallowPathPresence(
  filePath,
  fsApi = fs,
  platform = process.platform
) {
  if (fsApi.existsSync(filePath)) {
    return {
      present: true,
      mode: 'direct',
    };
  }

  if (platform !== 'win32') {
    return {
      present: false,
      mode: 'missing',
    };
  }

  try {
    fsApi.lstatSync(filePath);
    return {
      present: true,
      mode: 'direct',
    };
  } catch (error) {
    if (!['EACCES', 'EPERM'].includes(error?.code)) {
      return {
        present: false,
        mode: 'missing',
      };
    }
  }

  try {
    const entries = fsApi.readdirSync(path.dirname(filePath));

    if (entries.includes(path.basename(filePath))) {
      return {
        present: true,
        mode: 'directory-entry',
      };
    }
  } catch {
    // Treat unreadable/missing parent directories as absent.
  }

  return {
    present: false,
    mode: 'missing',
  };
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
  const requiredChecks = (artifact.verification.requiredFiles || []).map(
    (relativePath) => ({
      relativePath,
      ...inspectShallowPathPresence(
        path.join(snapshotRoot, relativePath)
      ),
    })
  );
  const requiredMissing = requiredChecks
    .filter((check) => !check.present)
    .map((check) => check.relativePath);
  const directoryEntryOnly = requiredChecks
    .filter((check) => check.mode === 'directory-entry')
    .map((check) => check.relativePath);

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
      'snapshot ' +
      resolvedRevision +
      ' contains required files' +
      (directoryEntryOnly.length > 0
        ? '; Windows host confirmed Linux-created cache link entries without dereferencing: ' +
          directoryEntryOnly.join(', ')
        : ''),
  };
}


function verifyRequiredFile(filePath, options = {}) {
  const fsApi = options.fsApi || fs;
  const platform = options.platform || process.platform;
  const containerProbe = options.containerProbe;

  try {
    const stat = fsApi.statSync(filePath);

    if (!stat.isFile()) {
      return {
        state: 'corrupt',
        mode: 'host',
        size: null,
        detail: 'required path is not a regular file',
      };
    }

    if (stat.size <= 0) {
      return {
        state: 'corrupt',
        mode: 'host',
        size: stat.size,
        detail: 'required file is zero bytes',
      };
    }

    return {
      state: 'verified',
      mode: 'host',
      size: stat.size,
      detail: 'verified non-empty local file',
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        state: 'missing',
        mode: 'host',
        size: null,
        detail: 'required file is missing',
      };
    }

    if (
      platform === 'win32' &&
      ['EACCES', 'EPERM'].includes(error?.code)
    ) {
      if (typeof containerProbe !== 'function') {
        return {
          state: 'unavailable',
          mode: 'container-readonly',
          size: null,
          detail:
            'Windows cannot dereference the cache entry and no read-only Linux verifier is available',
        };
      }

      try {
        const probed = containerProbe(filePath);

        if (probed?.verified) {
          return {
            state: 'verified',
            mode: 'container-readonly',
            size: probed.size ?? null,
            detail:
              'verified non-empty file through read-only Linux container',
          };
        }

        if (probed?.unavailable) {
          return {
            state: 'unavailable',
            mode: 'container-readonly',
            size: probed.size ?? null,
            detail:
              probed.detail ||
              'read-only Linux container verification is unavailable',
          };
        }

        if (probed?.missing) {
          return {
            state: 'missing',
            mode: 'container-readonly',
            size: probed.size ?? null,
            detail: probed.detail || 'required file is missing',
          };
        }

        return {
          state: 'corrupt',
          mode: 'container-readonly',
          size: probed?.size ?? null,
          detail:
            probed?.detail ||
            'required file failed read-only Linux container verification',
        };
      } catch (probeError) {
        return {
          state: 'unavailable',
          mode: 'container-readonly',
          size: null,
          detail:
            'read-only Linux container verification failed: ' +
            (probeError instanceof Error
              ? probeError.message
              : String(probeError)),
        };
      }
    }

    return {
      state: 'unavailable',
      mode: 'host',
      size: null,
      detail:
        'local file verification failed: ' +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

function defaultContainerProbeForArtifact(
  artifact,
  modelRoot,
  execFile = execFileSync
) {
  const providers = {
    musicgen: {
      image: 'harmonia/musicgen:dev',
      python: 'python3.9',
    },
    'stable-audio-3': {
      image: 'harmonia/stable-audio-3:dev',
      python: 'python',
    },
  };
  const provider = providers[artifact.providerId];

  if (!provider) {
    return () => ({
      verified: false,
      unavailable: true,
      detail:
        'no read-only Linux verifier image is configured for provider ' +
        artifact.providerId,
    });
  }

  return (filePath) => {
    const resolvedRoot = path.resolve(modelRoot);
    const relative = path.relative(resolvedRoot, path.resolve(filePath));

    if (
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)
    ) {
      return {
        verified: false,
        unavailable: true,
        detail: 'verification path escapes configured model root',
      };
    }

    const containerPath =
      '/workspace/models/' + relative.replace(/\\/g, '/');
    const python = [
      'import json, os, sys',
      'p = sys.argv[1]',
      'result = {"verified": False, "missing": False, "size": None}',
      'try:',
      '    st = os.stat(p)',
      '    result["size"] = st.st_size',
      '    result["verified"] = os.path.isfile(p) and st.st_size > 0',
      '    if not result["verified"]:',
      '        result["detail"] = "required path is not a non-empty regular file"',
      'except FileNotFoundError:',
      '    result["missing"] = True',
      '    result["detail"] = "required file is missing"',
      'except Exception as exc:',
      '    result["detail"] = repr(exc)',
      'print(json.dumps(result))',
    ].join('\n');

    try {
      const stdout = execFile(
        'docker',
        [
          'run',
          '--rm',
          '--network',
          'none',
          '--mount',
          'type=bind,source=' +
            resolvedRoot +
            ',target=/workspace/models,readonly',
          '--entrypoint',
          provider.python,
          provider.image,
          '-c',
          python,
          containerPath,
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 60000,
        }
      );

      return JSON.parse(String(stdout).trim());
    } catch (error) {
      return {
        verified: false,
        unavailable: true,
        detail:
          'Docker/image unavailable for read-only verification: ' +
          (error instanceof Error ? error.message : String(error)),
      };
    }
  };
}

function resolveHuggingFaceRevision(artifact, repoCacheRoot) {
  const expectedRevision = artifact.source.revision || null;
  const mainRevision = readTextIfExists(path.join(repoCacheRoot, 'refs', 'main'));
  const snapshots = listSnapshotRevisions(repoCacheRoot);

  if (
    expectedRevision &&
    fs.existsSync(path.join(repoCacheRoot, 'snapshots', expectedRevision))
  ) {
    return {
      expectedRevision,
      resolvedRevision: expectedRevision,
      mismatch: false,
    };
  }

  let resolvedRevision = null;

  if (
    mainRevision &&
    fs.existsSync(path.join(repoCacheRoot, 'snapshots', mainRevision))
  ) {
    resolvedRevision = mainRevision;
  } else if (snapshots.length > 0) {
    resolvedRevision = snapshots[snapshots.length - 1];
  }

  return {
    expectedRevision,
    resolvedRevision,
    mismatch: Boolean(
      expectedRevision &&
        resolvedRevision &&
        expectedRevision !== resolvedRevision
    ),
  };
}

function verifyHuggingFaceArtifact(
  artifact,
  artifactRoot,
  modelRoot,
  options = {}
) {
  const repoCacheRoot = huggingFaceRepoCacheRoot(
    artifactRoot,
    artifact.source.repoId
  );

  if (!fs.existsSync(repoCacheRoot)) {
    return {
      state: 'missing',
      resolvedRevision: null,
      checks: [],
      detail:
        'Hugging Face cache is absent for ' + artifact.source.repoId,
    };
  }

  const revision = resolveHuggingFaceRevision(artifact, repoCacheRoot);

  if (!revision.resolvedRevision) {
    return {
      state: 'corrupt',
      resolvedRevision: null,
      checks: [],
      detail: 'repository cache has no resolvable snapshot',
    };
  }

  if (revision.mismatch) {
    return {
      state: 'corrupt',
      resolvedRevision: revision.resolvedRevision,
      checks: [],
      detail:
        'expected snapshot ' +
        revision.expectedRevision +
        ' but found ' +
        revision.resolvedRevision,
    };
  }

  const snapshotRoot = path.join(
    repoCacheRoot,
    'snapshots',
    revision.resolvedRevision
  );
  const platform = options.platform || process.platform;
  const containerProbe =
    options.containerProbe ||
    (platform === 'win32'
      ? defaultContainerProbeForArtifact(
          artifact,
          modelRoot,
          options.execFileSyncApi || execFileSync
        )
      : null);

  const checks = (artifact.verification.requiredFiles || []).map(
    (relativePath) => ({
      relativePath,
      ...verifyRequiredFile(path.join(snapshotRoot, relativePath), {
        platform,
        containerProbe,
      }),
    })
  );

  const states = new Set(checks.map((check) => check.state));
  let state = 'verified';

  if (states.has('missing')) {
    state = 'missing';
  } else if (states.has('corrupt')) {
    state = 'corrupt';
  } else if (states.has('unavailable')) {
    state = 'unavailable';
  }

  return {
    state,
    resolvedRevision: revision.resolvedRevision,
    checks,
    detail:
      state === 'verified'
        ? 'all required Hugging Face files are non-empty and dereferenceable'
        : checks
            .filter((check) => check.state !== 'verified')
            .map(
              (check) =>
                check.relativePath +
                ': ' +
                check.detail
            )
            .join('; '),
  };
}

function verifyCheckpointArtifact(artifact, artifactRoot, options = {}) {
  if (!fs.existsSync(artifactRoot)) {
    return {
      state: 'missing',
      resolvedRevision: artifact.source.revision || null,
      checks: [],
      detail: 'artifact directory is absent',
    };
  }

  const checks = [];

  for (const relativePath of artifact.verification.requiredFiles || []) {
    checks.push({
      relativePath,
      ...verifyRequiredFile(path.join(artifactRoot, relativePath), {
        platform: options.platform || process.platform,
      }),
    });
  }

  const allFiles = listFilesRecursive(artifactRoot);

  for (const pattern of artifact.verification.checkpointGlobs || []) {
    const matcher = wildcardToRegExp(pattern);
    const matches = allFiles.filter((relativePath) => {
      const basename = path.posix.basename(relativePath);
      return matcher.test(relativePath) || matcher.test(basename);
    });

    if (matches.length === 0) {
      checks.push({
        relativePath: pattern,
        state: 'missing',
        mode: 'host',
        size: null,
        detail: 'required checkpoint pattern has no matches',
      });
      continue;
    }

    for (const relativePath of matches) {
      checks.push({
        relativePath,
        ...verifyRequiredFile(path.join(artifactRoot, relativePath), {
          platform: options.platform || process.platform,
        }),
      });
    }
  }

  const states = new Set(checks.map((check) => check.state));
  let state = 'verified';

  if (states.has('missing')) {
    state = 'missing';
  } else if (states.has('corrupt')) {
    state = 'corrupt';
  } else if (states.has('unavailable')) {
    state = 'unavailable';
  }

  return {
    state,
    resolvedRevision: artifact.source.revision || null,
    checks,
    detail:
      state === 'verified'
        ? 'all required config/checkpoint files are non-empty'
        : checks
            .filter((check) => check.state !== 'verified')
            .map(
              (check) =>
                check.relativePath +
                ': ' +
                check.detail
            )
            .join('; '),
  };
}

function verifyArtifact(artifact, modelRoot, options = {}) {
  const artifactRoot = safeResolveUnderRoot(
    modelRoot,
    artifact.destination
  );

  switch (artifact.verification.strategy) {
    case 'huggingface-snapshot':
      return verifyHuggingFaceArtifact(
        artifact,
        artifactRoot,
        modelRoot,
        options
      );
    case 'checkpoint-config-pair':
    case 'required-files':
      return verifyCheckpointArtifact(
        artifact,
        artifactRoot,
        options
      );
    default:
      return {
        state: 'unavailable',
        resolvedRevision: null,
        checks: [],
        detail:
          'verification strategy not implemented by verify: ' +
          artifact.verification.strategy,
      };
  }
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


function deriveVerificationModelState(binding, artifactRows) {
  const rows = binding.artifactIds
    .map((artifactId) =>
      artifactRows.find((row) => row.artifactId === artifactId)
    )
    .filter(Boolean);

  if (rows.length !== binding.artifactIds.length) {
    return 'unavailable';
  }

  if (rows.every((row) => row.state === 'verified')) {
    return 'verified';
  }

  if (rows.some((row) => row.state === 'corrupt')) {
    return 'corrupt';
  }

  if (rows.some((row) => row.state === 'unavailable')) {
    return 'unavailable';
  }

  if (rows.some((row) => row.state === 'missing')) {
    return 'missing';
  }

  return 'unavailable';
}

function createVerification(options = {}) {
  const registry = loadRegistry();
  const normalized = {
    command: 'verify',
    modelIds: options.modelIds || [],
    providerIds: options.providerIds || [],
    artifactIds: options.artifactIds || [],
    root: options.root || registry.modelsRoot,
    offline: Boolean(options.offline),
    json: Boolean(options.json),
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

  const artifactRows = artifacts.map((artifact) => {
    const directArtifact = normalized.artifactIds.includes(
      artifact.artifactId
    );
    const directModel = normalized.modelIds.some((modelId) => {
      const binding = registry.modelBindings.find(
        (candidate) => candidate.modelId === modelId
      );
      return binding?.artifactIds.includes(artifact.artifactId);
    });
    const directProvider =
      explicitSelection &&
      normalized.providerIds.includes(artifact.providerId);
    const requiredForSuccess =
      Boolean(artifact.defaultInstall) ||
      directArtifact ||
      directModel ||
      directProvider;
    const verification = verifyArtifact(
      artifact,
      modelRoot,
      options
    );

    return {
      artifactId: artifact.artifactId,
      providerId: artifact.providerId,
      modelIds: modelIdsForArtifact(
        registry,
        artifact.artifactId
      ),
      runtimeModelIds: artifact.runtimeModelIds,
      sourceKind: artifact.source.kind,
      sourceRef:
        artifact.source.repoId ||
        artifact.source.url,
      expectedRevision:
        artifact.source.revision || null,
      resolvedRevision:
        verification.resolvedRevision,
      relativePath: artifact.destination,
      verificationStrategy:
        artifact.verification.strategy,
      defaultInstall:
        Boolean(artifact.defaultInstall),
      requiredForSuccess,
      state: verification.state,
      checks: verification.checks || [],
      detail: verification.detail,
    };
  });

  const modelRows = bindings.map((binding) => ({
    modelId: binding.modelId,
    artifactIds: binding.artifactIds,
    state: deriveVerificationModelState(
      binding,
      artifactRows
    ),
  }));

  const optionalSkipped = artifactRows.filter(
    (row) =>
      !row.requiredForSuccess &&
      row.state !== 'verified'
  ).length;

  const summary = {
    selectedModels: modelRows.length,
    selectedArtifacts: artifactRows.length,
    verified: artifactRows.filter(
      (row) => row.state === 'verified'
    ).length,
    missing: artifactRows.filter(
      (row) => row.state === 'missing'
    ).length,
    corrupt: artifactRows.filter(
      (row) => row.state === 'corrupt'
    ).length,
    unavailable: artifactRows.filter(
      (row) => row.state === 'unavailable'
    ).length,
    optionalSkipped,
  };

  const ok = artifactRows.every(
    (row) =>
      !row.requiredForSuccess ||
      row.state === 'verified'
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    command: 'verify',
    ok,
    modelsRoot: normalized.root.replace(/\\/g, '/'),
    offline: true,
    databaseIntegration: 'not-yet-implemented',
    summary,
    models: modelRows,
    artifacts: artifactRows,
    warnings: [
      'Phase 3 verify is read-only and makes no network requests.',
      'Provider inference/runtime qualification remains separate evidence.',
    ],
  };
}

function writeReport(result) {
  const reportDir = path.join(repoRoot, 'generated', 'model-manager');
  fs.mkdirSync(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(
    reportDir,
    timestamp + '-' + result.command + '.json'
  );

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


function printHumanVerification(result, reportPath) {
  const widths = {
    model: 33,
    artifact: 38,
    state: 18,
    required: 10,
  };
  const pad = (value, width) => {
    const text = String(value ?? '');
    return text.length >= width
      ? text.slice(0, width - 1) + '…'
      : text.padEnd(width);
  };

  console.log('============================================================');
  console.log(' HARMONIA MODEL VERIFY');
  console.log('============================================================');
  console.log('modelsRoot: ' + result.modelsRoot);
  console.log('network: none');
  console.log('mutation: none');
  console.log('');

  console.log(
    [
      pad('MODEL', widths.model),
      pad('ARTIFACT', widths.artifact),
      pad('STATE', widths.state),
      pad('REQUIRED', widths.required),
    ].join(' ')
  );
  console.log(
    [
      '-'.repeat(widths.model),
      '-'.repeat(widths.artifact),
      '-'.repeat(widths.state),
      '-'.repeat(widths.required),
    ].join(' ')
  );

  for (const row of result.artifacts) {
    console.log(
      [
        pad(row.modelIds.join(','), widths.model),
        pad(row.artifactId, widths.artifact),
        pad(row.state, widths.state),
        pad(row.requiredForSuccess ? 'yes' : 'no', widths.required),
      ].join(' ')
    );

    if (row.detail) {
      console.log('  ' + row.detail);
    }

    for (const check of row.checks || []) {
      console.log(
        '  - ' +
          check.relativePath +
          ' state=' +
          check.state +
          ' mode=' +
          check.mode +
          (check.size == null
            ? ''
            : ' size=' + check.size)
      );
    }
  }

  console.log('');
  console.log('SUMMARY');

  for (const [key, value] of Object.entries(result.summary)) {
    console.log(key + '=' + value);
  }

  console.log('');
  console.log('report=' + reportPath);
  console.log(
    result.ok
      ? 'MODEL_VERIFY_OK'
      : 'MODEL_VERIFY_FAILED'
  );
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (!args.command || args.command === 'help') {
    console.log(usage());
    return 0;
  }

  if (!['plan', 'verify'].includes(args.command)) {
    fail(
      'Command "' +
        args.command +
        '" is not implemented yet. Available commands: plan, verify.'
    );
  }

  const result =
    args.command === 'plan'
      ? createPlan(args)
      : createVerification(args);
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
  } else if (args.command === 'plan') {
    printHumanPlan(result, reportPath);
  } else {
    printHumanVerification(result, reportPath);
  }

  return result.ok ? 0 : 1;
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
  createVerification,
  defaultContainerProbeForArtifact,
  deriveAction,
  deriveModelState,
  hasHuggingFaceCredential,
  inspectArtifact,
  inspectCheckpointArtifact,
  inspectHuggingFaceArtifact,
  inspectShallowPathPresence,
  isSafeRelativePath,
  verifyArtifact,
  verifyCheckpointArtifact,
  verifyHuggingFaceArtifact,
  verifyRequiredFile,
  loadRegistry,
  parseArgs,
  safeResolveUnderRoot,
  selectArtifacts,
  selectBindings,
  wildcardToRegExp,
};
