#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const {
  createVerification,
  loadRegistry,
  parseArgs,
} = require('./model-manager.cjs');

const repoRoot = path.resolve(__dirname, '..');
const generatedRoot = path.join(
  repoRoot,
  'generated',
  'model-manager'
);

const INVENTORY_SCHEMA_VERSION =
  'harmonia-model-inventory-v1';

function numericChecks(row) {
  return (row.checks || []).filter(
    (check) =>
      Number.isFinite(check.size) &&
      check.size >= 0
  );
}

function sourceRevision(row) {
  return (
    row.resolvedRevision ||
    row.expectedRevision ||
    null
  );
}

function sanitizeDetail(
  value,
  observedRoot
) {
  if (!value) {
    return null;
  }

  let detail = String(value);

  const candidates = new Set([
    path.resolve(observedRoot),
    path
      .resolve(observedRoot)
      .replace(/\\/g, '/'),
  ]);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    detail = detail
      .split(candidate)
      .join('<modelsRoot>');
  }

  return detail
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function containsAbsoluteLocalPath(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return (
    /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/(?:home|mnt|Users|workspace|tmp|var|opt|srv)\/)/.test(
      value
    )
  );
}

function buildInventory(
  verification,
  options = {}
) {
  const registry =
    options.registry ||
    loadRegistry();
  const generatedAt =
    options.generatedAt ||
    new Date();
  const observedRoot =
    options.observedRoot ||
    verification.modelsRoot ||
    registry.modelsRoot;

  const artifacts =
    verification.artifacts.map(
      (row) => {
        const artifact =
          registry.artifacts.find(
            (candidate) =>
              candidate.artifactId ===
              row.artifactId
          );

        if (!artifact) {
          throw new Error(
            'Verification referenced unknown artifact: ' +
              row.artifactId
          );
        }

        const checks =
          numericChecks(row);

        const inventoryRow = {
          artifactId:
            row.artifactId,
          providerId:
            row.providerId,
          modelIds:
            [...row.modelIds],
          runtimeModelIds:
            [...row.runtimeModelIds],
          sourceKind:
            row.sourceKind,
          sourceRef:
            row.sourceRef,
          sourceRevision:
            sourceRevision(row),
          localPath:
            row.relativePath,
          status:
            row.state,
          requiredForSuccess:
            Boolean(
              row.requiredForSuccess
            ),
          defaultInstall:
            Boolean(
              row.defaultInstall
            ),
          gated:
            Boolean(
              artifact.source.gated
            ),
          verificationStrategy:
            row.verificationStrategy,
          filesCount:
            checks.length,
          sizeBytes:
            checks.reduce(
              (total, check) =>
                total + check.size,
              0
            ),
          verifiedAt:
            row.state === 'verified'
              ? generatedAt.toISOString()
              : null,
          detail:
            sanitizeDetail(
              row.detail,
              observedRoot
            ),
        };

        const serialized =
          JSON.stringify(
            inventoryRow
          );

        if (
          containsAbsoluteLocalPath(
            serialized
          )
        ) {
          throw new Error(
            'Portable inventory rejected an absolute local path for artifact ' +
              row.artifactId
          );
        }

        return inventoryRow;
      }
    );

  return {
    schemaVersion:
      INVENTORY_SCHEMA_VERSION,
    generatedAt:
      generatedAt.toISOString(),
    modelsRoot:
      registry.modelsRoot,
    ok:
      verification.ok,
    summary: {
      ...verification.summary,
      filesCount:
        artifacts.reduce(
          (total, row) =>
            total + row.filesCount,
          0
        ),
      sizeBytes:
        artifacts.reduce(
          (total, row) =>
            total + row.sizeBytes,
          0
        ),
    },
    artifacts,
    warnings: [
      'Observed inventory is generated evidence; inventory/model_registry.json remains the desired-state acquisition contract.',
      'File counts and byte totals describe concrete deep-verification evidence, not every incidental file in shared caches.',
    ],
  };
}

function safeTimestamp(
  date = new Date()
) {
  return date
    .toISOString()
    .replace(/[:.]/g, '-');
}

function writeInventoryFiles(
  inventory,
  options = {}
) {
  const outputRoot =
    options.outputRoot ||
    generatedRoot;

  fs.mkdirSync(
    outputRoot,
    {
      recursive: true,
    }
  );

  const stablePath =
    path.join(
      outputRoot,
      'model-inventory.json'
    );

  const timestampedPath =
    path.join(
      outputRoot,
      safeTimestamp(
        new Date(
          inventory.generatedAt
        )
      ) +
        '-inventory.json'
    );

  const payload =
    JSON.stringify(
      inventory,
      null,
      2
    ) + '\n';

  fs.writeFileSync(
    stablePath,
    payload,
    'utf8'
  );

  fs.writeFileSync(
    timestampedPath,
    payload,
    'utf8'
  );

  return {
    stablePath,
    timestampedPath,
  };
}

function createInventory(
  options = {}
) {
  const verification =
    options.verification ||
    createVerification({
      root: options.root,
      modelIds:
        options.modelIds || [],
      providerIds:
        options.providerIds || [],
      artifactIds:
        options.artifactIds || [],
      offline: true,
      json: true,
      verbose:
        Boolean(options.verbose),
      platform:
        options.platform,
      containerProbe:
        options.containerProbe,
    });

  return buildInventory(
    verification,
    {
      registry:
        options.registry,
      generatedAt:
        options.generatedAt,
      observedRoot:
        options.root ||
        verification.modelsRoot,
    }
  );
}

function printHuman(
  inventory,
  paths
) {
  console.log(
    '============================================================'
  );
  console.log(
    ' HARMONIA MODEL INVENTORY'
  );
  console.log(
    '============================================================'
  );
  console.log(
    'schemaVersion=' +
      inventory.schemaVersion
  );
  console.log(
    'modelsRoot=' +
      inventory.modelsRoot
  );
  console.log(
    'generatedAt=' +
      inventory.generatedAt
  );
  console.log('');

  for (const row of inventory.artifacts) {
    console.log(
      [
        row.artifactId,
        'status=' + row.status,
        'files=' + row.filesCount,
        'bytes=' + row.sizeBytes,
        'path=' + row.localPath,
      ].join(' ')
    );
  }

  console.log('');
  console.log('SUMMARY');

  for (
    const [key, value]
    of Object.entries(
      inventory.summary
    )
  ) {
    console.log(
      key + '=' + value
    );
  }

  console.log('');
  console.log(
    'stable=' +
      paths.stablePath
  );
  console.log(
    'timestamped=' +
      paths.timestampedPath
  );
  console.log(
    inventory.ok
      ? 'MODEL_INVENTORY_OK'
      : 'MODEL_INVENTORY_INCOMPLETE'
  );
}

function validateInventoryArgs(
  args
) {
  if (
    args.dryRun ||
    args.force ||
    args.requireDb
  ) {
    throw new Error(
      'models:inventory is always read-only; --dry-run, --force, and --require-db are not applicable.'
    );
  }
}

function main(
  argv = process.argv.slice(2)
) {
  const args =
    parseArgs([
      'inventory',
      ...argv,
    ]);

  validateInventoryArgs(args);

  const inventory =
    createInventory(args);

  const paths =
    writeInventoryFiles(
      inventory
    );

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ...inventory,
          inventoryPath:
            paths.stablePath,
          reportPath:
            paths.timestampedPath,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    printHuman(
      inventory,
      paths
    );
  }

  return inventory.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode =
      main();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.stack ||
          error.message
        : String(error)
    );
    process.exitCode = 1;
  }
}

module.exports = {
  INVENTORY_SCHEMA_VERSION,
  buildInventory,
  containsAbsoluteLocalPath,
  createInventory,
  numericChecks,
  sanitizeDetail,
  sourceRevision,
  writeInventoryFiles,
};
