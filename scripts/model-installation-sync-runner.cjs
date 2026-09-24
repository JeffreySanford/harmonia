#!/usr/bin/env node
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const syncScript = path.join(
  repoRoot,
  'scripts',
  'model-installation-sync.cjs'
);

function buildSyncArgs(options = {}) {
  const args = [syncScript];

  if (options.root) {
    args.push('--root', options.root);
  }

  for (const modelId of options.modelIds || []) {
    args.push('--model', modelId);
  }

  for (const providerId of options.providerIds || []) {
    args.push('--provider', providerId);
  }

  for (const artifactId of options.artifactIds || []) {
    args.push('--artifact', artifactId);
  }

  if (options.requireDb) {
    args.push('--require-db');
  }

  args.push('--json');

  return args;
}

function runLifecycleDatabaseSync(
  options = {},
  execFileSyncApi = execFileSync
) {
  try {
    const stdout = execFileSyncApi(
      process.execPath,
      buildSyncArgs(options),
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
        maxBuffer:
          16 * 1024 * 1024,
        stdio: [
          'ignore',
          'pipe',
          'pipe',
        ],
      }
    );

    const result = JSON.parse(stdout);

    return {
      status:
        result.database?.status ||
        'unavailable',
      synchronized:
        Boolean(
          result.database
            ?.synchronized
        ),
      records:
        Array.isArray(
          result.database?.records
        )
          ? result.database.records.length
          : 0,
      warning:
        result.database?.warning || null,
      required:
        Boolean(options.requireDb),
    };
  } catch {
    return {
      status: 'unavailable',
      synchronized: false,
      records: 0,
      warning:
        'MongoDB metadata synchronization could not be completed.',
      required:
        Boolean(options.requireDb),
    };
  }
}

function lifecycleDatabaseState(
  lifecycleResult,
  options = {},
  execFileSyncApi = execFileSync
) {
  if (options.dryRun) {
    return {
      status: 'skipped-dry-run',
      synchronized: false,
      records: 0,
      warning: null,
      required:
        Boolean(options.requireDb),
    };
  }

  if (!lifecycleResult?.ok) {
    return {
      status:
        'skipped-lifecycle-failed',
      synchronized: false,
      records: 0,
      warning: null,
      required:
        Boolean(options.requireDb),
    };
  }

  return runLifecycleDatabaseSync(
    options,
    execFileSyncApi
  );
}

function applyDatabaseRequirement(
  lifecycleResult,
  databaseIntegration
) {
  lifecycleResult.databaseIntegration =
    databaseIntegration;

  if (
    databaseIntegration.required &&
    !databaseIntegration.synchronized
  ) {
    lifecycleResult.ok = false;

    const warning =
      databaseIntegration.warning ||
      'Required MongoDB metadata synchronization failed.';

    lifecycleResult.warnings = [
      ...(lifecycleResult.warnings || []),
      warning,
    ];
  } else if (
    databaseIntegration.warning
  ) {
    lifecycleResult.warnings = [
      ...(lifecycleResult.warnings || []),
      databaseIntegration.warning,
    ];
  }

  return lifecycleResult;
}

module.exports = {
  applyDatabaseRequirement,
  buildSyncArgs,
  lifecycleDatabaseState,
  runLifecycleDatabaseSync,
};
