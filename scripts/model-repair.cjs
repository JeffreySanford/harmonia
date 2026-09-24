#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const {
  createInitialization,
  getHuggingFaceCredential,
  loadRegistry,
  missingHuggingFaceDownloadRepos,
  parseArgs,
  safeResolveUnderRoot,
  selectArtifacts,
  selectBindings,
  verifyArtifact,
} = require('./model-manager.cjs');

const repoRoot = path.resolve(__dirname, '..');
const RESULT_SCHEMA_VERSION =
  'harmonia-model-manager-result-v1';

function fail(message, code = 2) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function modelIdsForArtifact(
  registry,
  artifactId
) {
  return registry.modelBindings
    .filter((binding) =>
      binding.artifactIds.includes(artifactId)
    )
    .map((binding) => binding.modelId)
    .sort();
}

function selectRepairTargets(
  registry,
  options
) {
  const explicitSelection =
    options.modelIds.length > 0 ||
    options.providerIds.length > 0 ||
    options.artifactIds.length > 0;

  let bindings = selectBindings(
    registry,
    options
  );
  let artifacts = selectArtifacts(
    registry,
    bindings,
    options
  );

  if (!explicitSelection) {
    artifacts = artifacts.filter(
      (artifact) => artifact.defaultInstall
    );

    const selected = new Set(
      artifacts.map(
        (artifact) => artifact.artifactId
      )
    );

    bindings = bindings.filter(
      (binding) =>
        binding.artifactIds.some(
          (artifactId) =>
            selected.has(artifactId)
        )
    );
  }

  if (
    bindings.length === 0 ||
    artifacts.length === 0
  ) {
    fail('Selectors resolved to no model artifacts.');
  }

  return {
    explicitSelection,
    bindings,
    artifacts,
  };
}

function createOperationId() {
  return (
    'repair-' +
    new Date().toISOString().replace(/[:.]/g, '-') +
    '-' +
    process.pid
  );
}

function quarantineDestination(
  artifact,
  modelRoot,
  operationId
) {
  const source = safeResolveUnderRoot(
    modelRoot,
    artifact.destination
  );

  if (!fs.existsSync(source)) {
    return null;
  }

  const relative = path.posix.join(
    '.quarantine',
    artifact.artifactId,
    operationId || createOperationId()
  );
  const target = safeResolveUnderRoot(
    modelRoot,
    relative
  );

  if (fs.existsSync(target)) {
    fail(
      'Repair quarantine destination already exists: ' +
        relative
    );
  }

  fs.mkdirSync(path.dirname(target), {
    recursive: true,
  });
  fs.renameSync(source, target);

  return relative;
}

function deriveModelState(
  binding,
  artifactRows
) {
  const rows = binding.artifactIds
    .map((artifactId) =>
      artifactRows.find(
        (row) =>
          row.artifactId === artifactId
      )
    )
    .filter(Boolean);

  if (rows.length === 0) {
    return 'unavailable';
  }

  if (
    rows.every(
      (row) => row.afterState === 'verified'
    )
  ) {
    return 'verified';
  }

  if (
    rows.some(
      (row) => row.afterState === 'corrupt'
    )
  ) {
    return 'corrupt';
  }

  if (
    rows.some(
      (row) =>
        row.afterState === 'unavailable'
    )
  ) {
    return 'unavailable';
  }

  if (
    rows.some(
      (row) => row.afterState === 'missing'
    )
  ) {
    return 'missing';
  }

  return 'unavailable';
}

function createRepair(options = {}) {
  const registry = loadRegistry();
  const normalized = {
    command: 'repair',
    modelIds: options.modelIds || [],
    providerIds: options.providerIds || [],
    artifactIds: options.artifactIds || [],
    root: options.root || registry.modelsRoot,
    offline: Boolean(options.offline),
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    json: Boolean(options.json),
    verbose: Boolean(options.verbose),
  };
  const modelRoot = path.isAbsolute(
    normalized.root
  )
    ? normalized.root
    : path.resolve(
        repoRoot,
        normalized.root
      );
  const {
    explicitSelection,
    bindings,
    artifacts,
  } = selectRepairTargets(
    registry,
    normalized
  );
  const credential =
    Object.prototype.hasOwnProperty.call(
      options,
      'credential'
    )
      ? options.credential
      : getHuggingFaceCredential();

  const evidence = artifacts.map(
    (artifact) => {
      const before = verifyArtifact(
        artifact,
        modelRoot,
        options
      );
      const missingRuntimeRepos =
        artifact.source.kind === 'huggingface'
          ? missingHuggingFaceDownloadRepos(
              artifact,
              modelRoot
            )
          : [];
      const destination =
        safeResolveUnderRoot(
          modelRoot,
          artifact.destination
        );

      return {
        artifact,
        before,
        missingRuntimeRepos,
        destinationExists:
          fs.existsSync(destination),
        fullyVerified:
          before.state === 'verified' &&
          missingRuntimeRepos.length === 0,
      };
    }
  );

  const defaultAuthBlocked =
    !explicitSelection &&
    !normalized.dryRun &&
    !normalized.offline &&
    !credential &&
    evidence.some(
      ({ artifact, fullyVerified }) =>
        !fullyVerified &&
        artifact.source.kind === 'huggingface' &&
        artifact.source.gated
    );

  const artifactRows = evidence.map(
    (entry) =>
      repairOne(
        entry,
        {
          registry,
          modelRoot,
          normalized,
          credential,
          defaultAuthBlocked,
          options,
        }
      )
  );

  const count = (action) =>
    artifactRows.filter(
      (row) => row.action === action
    ).length;

  const summary = {
    selectedModels: bindings.length,
    selectedArtifacts: artifactRows.length,
    verifiedNoop: count('none'),
    repaired: count('repaired'),
    plannedRepairs:
      count('would-repair') +
      count('would-quarantine-repair'),
    forceRequired: count('force-required'),
    quarantined: artifactRows.filter(
      (row) => Boolean(row.quarantinePath)
    ).length,
    authenticationRequired:
      count('authenticate'),
    prerequisiteBlocked:
      count('blocked-prerequisite'),
    offlineBlocked:
      count('offline-blocked'),
    failed: count('repair-failed'),
  };

  const ok = artifactRows.every(
    (row) =>
      [
        'none',
        'repaired',
        'would-repair',
        'would-quarantine-repair',
      ].includes(row.action)
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    command: 'repair',
    ok,
    modelsRoot:
      normalized.root.replace(/\\/g, '/'),
    offline: normalized.offline,
    dryRun: normalized.dryRun,
    force: normalized.force,
    databaseIntegration:
      'not-yet-implemented',
    summary,
    models: bindings.map((binding) => ({
      modelId: binding.modelId,
      artifactIds: binding.artifactIds,
      state: deriveModelState(
        binding,
        artifactRows
      ),
    })),
    artifacts: artifactRows,
    warnings: [
      'Repair never modifies deeply verified artifacts.',
      'Forced quarantine replacement is limited to exclusive HTTP-ZIP destinations.',
      'Shared Hugging Face destructive repair, provider-active checks, locks, and Mongo synchronization remain future work.',
    ],
  };
}

function repairOne(
  entry,
  context
) {
  const {
    artifact,
    before,
    missingRuntimeRepos,
    destinationExists,
    fullyVerified,
  } = entry;
  const {
    registry,
    modelRoot,
    normalized,
    credential,
    defaultAuthBlocked,
    options,
  } = context;

  const base = {
    artifactId: artifact.artifactId,
    providerId: artifact.providerId,
    modelIds: modelIdsForArtifact(
      registry,
      artifact.artifactId
    ),
    sourceKind: artifact.source.kind,
    sourceRef:
      artifact.source.repoId ||
      artifact.source.url,
    relativePath: artifact.destination,
    beforeState: before.state,
    expectedRevision:
      artifact.source.revision || null,
    resolvedRevision:
      before.resolvedRevision || null,
  };

  if (fullyVerified) {
    return {
      ...base,
      afterState: 'verified',
      action: 'none',
      detail:
        'artifact already deeply verifies; repair made no changes',
    };
  }

  if (
    artifact.source.kind === 'huggingface' &&
    artifact.source.gated &&
    !credential
  ) {
    return {
      ...base,
      afterState: before.state,
      action: 'authenticate',
      detail:
        'gated Hugging Face artifact requires a configured credential before repair',
    };
  }

  if (defaultAuthBlocked) {
    return {
      ...base,
      afterState: before.state,
      action: 'blocked-prerequisite',
      detail:
        'default repair is blocked until required gated authentication prerequisites are available',
    };
  }

  if (normalized.offline) {
    return {
      ...base,
      afterState: before.state,
      action: 'offline-blocked',
      detail:
        'artifact does not verify and repair is offline',
    };
  }

  const sharedHfDestructiveRepair =
    artifact.source.kind === 'huggingface' &&
    destinationExists &&
    before.state !== 'missing' &&
    !(
      before.state === 'verified' &&
      missingRuntimeRepos.length > 0
    );

  if (sharedHfDestructiveRepair) {
    return {
      ...base,
      afterState: before.state,
      action: 'force-required',
      detail:
        'shared Hugging Face cache requires a future granular repair path; whole-directory replacement is unsafe',
    };
  }

  if (normalized.dryRun) {
    if (
      artifact.source.kind === 'http-zip' &&
      destinationExists
    ) {
      if (!normalized.force) {
        return {
          ...base,
          afterState: before.state,
          action: 'force-required',
          detail:
            'non-empty DiffSinger destination requires --force before quarantine and replacement',
        };
      }

      return {
        ...base,
        afterState: before.state,
        action:
          'would-quarantine-repair',
        detail:
          'dry-run: existing DiffSinger destination would be quarantined before staged replacement',
      };
    }

    return {
      ...base,
      afterState: before.state,
      action: 'would-repair',
      detail:
        'dry-run: missing artifact content would be restored through its source adapter',
    };
  }

  let quarantinePath = null;

  if (
    artifact.source.kind === 'http-zip' &&
    destinationExists
  ) {
    if (!normalized.force) {
      return {
        ...base,
        afterState: before.state,
        action: 'force-required',
        detail:
          'non-empty DiffSinger destination requires --force before quarantine and replacement',
      };
    }

    quarantinePath =
      quarantineDestination(
        artifact,
        modelRoot,
        options.operationId
      );
  }

  const initialization =
    createInitialization({
      root: modelRoot,
      modelIds: [],
      providerIds: [],
      artifactIds: [
        artifact.artifactId,
      ],
      platform:
        options.platform ||
        process.platform,
      credential,
      huggingFaceDownloadExecutor:
        options.huggingFaceDownloadExecutor,
      httpZipDownloadExecutor:
        options.httpZipDownloadExecutor,
      downloadExecutor:
        options.downloadExecutor,
      execFileSyncApi:
        options.execFileSyncApi,
      spawnSyncApi:
        options.spawnSyncApi,
      verbose: normalized.verbose,
    });

  const initRow =
    initialization.artifacts[0];
  const after = verifyArtifact(
    artifact,
    modelRoot,
    options
  );
  const afterMissingRuntimeRepos =
    artifact.source.kind === 'huggingface'
      ? missingHuggingFaceDownloadRepos(
          artifact,
          modelRoot
        )
      : [];
  const repaired =
    initialization.ok &&
    after.state === 'verified' &&
    afterMissingRuntimeRepos.length === 0;

  return {
    ...base,
    afterState:
      repaired
        ? 'verified'
        : after.state,
    action:
      repaired
        ? 'repaired'
        : 'repair-failed',
    quarantinePath,
    operationId:
      initRow?.operationId || null,
    bytesDownloaded:
      initRow?.bytesDownloaded ?? null,
    detail:
      repaired
        ? quarantinePath
          ? 'replacement verified; previous destination retained in quarantine'
          : 'artifact restored and deeply verified'
        : initRow?.detail ||
          after.detail ||
          'repair failed verification',
  };
}

function writeReport(result) {
  const reportDir = path.join(
    repoRoot,
    'generated',
    'model-manager'
  );
  fs.mkdirSync(reportDir, {
    recursive: true,
  });

  const timestamp =
    new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(
    reportDir,
    timestamp + '-repair.json'
  );

  fs.writeFileSync(
    reportPath,
    JSON.stringify(result, null, 2) + '\n',
    'utf8'
  );

  return path
    .relative(repoRoot, reportPath)
    .replace(/\\/g, '/');
}

function printHuman(result, reportPath) {
  console.log(
    '============================================================'
  );
  console.log(' HARMONIA MODEL REPAIR');
  console.log(
    '============================================================'
  );
  console.log('modelsRoot: ' + result.modelsRoot);
  console.log(
    'network: ' +
      (result.offline ? 'disabled' : 'allowed')
  );
  console.log(
    'mutation: ' +
      (result.dryRun
        ? 'none (dry-run)'
        : 'conservative repair')
  );
  console.log('');

  for (const row of result.artifacts) {
    console.log(
      row.artifactId +
        ' before=' +
        row.beforeState +
        ' after=' +
        row.afterState +
        ' action=' +
        row.action
    );

    if (row.quarantinePath) {
      console.log(
        '  quarantine=' +
          row.quarantinePath
      );
    }

    if (row.detail) {
      console.log('  ' + row.detail);
    }
  }

  console.log('');
  console.log('SUMMARY');

  for (
    const [key, value]
    of Object.entries(result.summary)
  ) {
    console.log(key + '=' + value);
  }

  console.log('');
  console.log('report=' + reportPath);
  console.log(
    result.ok
      ? 'MODEL_REPAIR_OK'
      : 'MODEL_REPAIR_FAILED'
  );
}

function main(
  argv = process.argv.slice(2)
) {
  const parsed = parseArgs([
    'repair',
    ...argv,
  ]);

  const result = createRepair(parsed);
  const reportPath = writeReport(result);

  if (parsed.json) {
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
    printHuman(result, reportPath);
  }

  return result.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    const code =
      Number(error?.exitCode) || 1;
    console.error(
      error instanceof Error
        ? error.stack || error.message
        : String(error)
    );
    process.exitCode = code;
  }
}

module.exports = {
  createRepair,
  quarantineDestination,
  selectRepairTargets,
};
