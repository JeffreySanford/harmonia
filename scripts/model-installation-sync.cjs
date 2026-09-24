#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const mongoose = require('mongoose');

const {
  createVerification,
  loadRegistry,
  parseArgs,
} = require('./model-manager.cjs');

const repoRoot = path.resolve(__dirname, '..');
const MAX_ERROR_LENGTH = 2000;

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  try {
    return parseEnv(
      fs.readFileSync(envPath, 'utf8')
    );
  } catch {
    return {};
  }
}

function resolveMongoUri(
  env = readLocalEnv(),
  processEnv = process.env
) {
  const explicit =
    processEnv.MONGODB_URI?.trim() ||
    env.MONGODB_URI?.trim();

  if (explicit) {
    return explicit;
  }

  const password =
    processEnv.MONGO_HARMONIA_PASSWORD?.trim() ||
    env.MONGO_HARMONIA_PASSWORD?.trim();

  if (!password) {
    return null;
  }

  return (
    'mongodb://harmonia_app:' +
    encodeURIComponent(password) +
    '@127.0.0.1:27017/harmonia?authSource=harmonia'
  );
}

function sanitizeError(value) {
  if (value == null) {
    return null;
  }

  let text = String(value)
    .replace(
      /([A-Za-z][A-Za-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s]+@/g,
      '$1***@'
    )
    .replace(
      /((?:access[_-]?token|hf[_-]?token|authorization|api[_-]?key|password)\s*[=:]\s*)[^\s,;]+/gi,
      '$1***'
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  if (text.length > MAX_ERROR_LENGTH) {
    text =
      text.slice(
        0,
        MAX_ERROR_LENGTH - 1
      ) + '…';
  }

  return text;
}

function numericChecks(row) {
  return (row.checks || []).filter(
    (check) =>
      Number.isFinite(check.size) &&
      check.size >= 0
  );
}

function buildInstallationDocuments(
  verification,
  registry = loadRegistry(),
  now = new Date()
) {
  const artifactById = new Map(
    registry.artifacts.map(
      (artifact) => [
        artifact.artifactId,
        artifact,
      ]
    )
  );

  return verification.artifacts.map(
    (row) => {
      const artifact = artifactById.get(
        row.artifactId
      );

      if (!artifact) {
        throw new Error(
          'Verification referenced unknown artifact: ' +
            row.artifactId
        );
      }

      const checks = numericChecks(row);
      const verified =
        row.state === 'verified';

      return {
        artifactId: row.artifactId,
        providerId: row.providerId,
        modelIds: [...row.modelIds],
        runtimeModelIds: [
          ...row.runtimeModelIds,
        ],
        sourceKind: row.sourceKind,
        sourceRef: row.sourceRef,
        sourceRevision:
          row.resolvedRevision ||
          row.expectedRevision ||
          artifact.source.revision ||
          null,
        localPath: row.relativePath,
        status: row.state,
        fileCount: checks.length,
        bytes: checks.reduce(
          (total, check) =>
            total + check.size,
          0
        ),
        verificationStrategy:
          row.verificationStrategy,
        verifiedAt:
          verified ? now : null,
        licenseAcceptanceRequired:
          Boolean(
            artifact.license
              ?.acceptanceRequired
          ),
        gated:
          Boolean(artifact.source.gated),
        lastError:
          verified
            ? null
            : sanitizeError(row.detail),
      };
    }
  );
}

async function upsertInstallationDocuments(
  collection,
  documents,
  now = new Date()
) {
  const rows = [];

  for (const document of documents) {
    const existing =
      await collection.findOne(
        {
          artifactId:
            document.artifactId,
        },
        {
          projection: {
            installedAt: 1,
            lastUsedAt: 1,
            createdAt: 1,
          },
        }
      );

    const installedAt =
      existing?.installedAt ||
      (
        document.status === 'verified'
          ? now
          : null
      );

    const lastUsedAt =
      existing?.lastUsedAt || null;

    const createdAt =
      existing?.createdAt || now;

    const persisted = {
      ...document,
      installedAt,
      lastUsedAt,
      updatedAt: now,
    };

    await collection.updateOne(
      {
        artifactId:
          document.artifactId,
      },
      {
        $set: persisted,
        $setOnInsert: {
          createdAt,
        },
      },
      {
        upsert: true,
      }
    );

    rows.push({
      artifactId:
        document.artifactId,
      status:
        document.status,
      installedAt,
      verifiedAt:
        document.verifiedAt,
      fileCount:
        document.fileCount,
      bytes:
        document.bytes,
    });
  }

  return rows;
}

async function defaultConnectMongo(uri) {
  const connection =
    await mongoose
      .createConnection(uri, {
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise();

  return {
    collection:
      connection.collection(
        'model_installations'
      ),
    close: () => connection.close(),
  };
}

async function synchronizeVerification(
  verification,
  options = {}
) {
  const requireDb =
    Boolean(options.requireDb);
  const uri =
    options.uri ||
    resolveMongoUri(
      options.env,
      options.processEnv
    );

  if (!uri) {
    const message =
      'MongoDB configuration is unavailable; model filesystem verification remains authoritative.';

    if (requireDb) {
      throw new Error(message);
    }

    return {
      status: 'unavailable',
      synchronized: false,
      records: [],
      warning: message,
    };
  }

  const documents =
    buildInstallationDocuments(
      verification,
      options.registry,
      options.now || new Date()
    );

  const connectMongo =
    options.connectMongo ||
    defaultConnectMongo;

  let connection;

  try {
    connection =
      await connectMongo(uri);

    const records =
      await upsertInstallationDocuments(
        connection.collection,
        documents,
        options.now || new Date()
      );

    return {
      status: 'synchronized',
      synchronized: true,
      records,
      warning: null,
    };
  } catch {
    const message =
      'MongoDB synchronization unavailable; filesystem verification remains authoritative.';

    if (requireDb) {
      throw new Error(message);
    }

    return {
      status: 'unavailable',
      synchronized: false,
      records: [],
      warning: message,
    };
  } finally {
    if (connection?.close) {
      try {
        await connection.close();
      } catch {
        // Synchronization result is already known.
      }
    }
  }
}

async function createInstallationSync(
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

  const database =
    await synchronizeVerification(
      verification,
      options
    );

  return {
    schemaVersion:
      'harmonia-model-installation-sync-v1',
    command: 'db-sync',
    ok:
      verification.ok &&
      (
        database.synchronized ||
        !options.requireDb
      ),
    modelsRoot:
      verification.modelsRoot,
    verification: {
      ok: verification.ok,
      summary:
        verification.summary,
    },
    database,
    artifacts:
      verification.artifacts.map(
        (row) => ({
          artifactId:
            row.artifactId,
          state:
            row.state,
          requiredForSuccess:
            row.requiredForSuccess,
        })
      ),
  };
}

function printHuman(result) {
  console.log(
    '============================================================'
  );
  console.log(
    ' HARMONIA MODEL INSTALLATION DB SYNC'
  );
  console.log(
    '============================================================'
  );
  console.log(
    'modelsRoot=' + result.modelsRoot
  );
  console.log(
    'filesystemOk=' +
      result.verification.ok
  );
  console.log(
    'databaseStatus=' +
      result.database.status
  );

  if (result.database.warning) {
    console.log(
      'warning=' +
        result.database.warning
    );
  }

  console.log(
    'records=' +
      result.database.records.length
  );
  console.log(
    result.ok
      ? 'MODEL_INSTALLATIONS_SYNC_OK'
      : 'MODEL_INSTALLATIONS_SYNC_FAILED'
  );
}

async function main(
  argv = process.argv.slice(2)
) {
  const parsed = parseArgs([
    'db-sync',
    ...argv,
  ]);

  const result =
    await createInstallationSync(
      parsed
    );

  if (parsed.json) {
    process.stdout.write(
      JSON.stringify(
        result,
        null,
        2
      ) + '\n'
    );
  } else {
    printHuman(result);
  }

  return result.ok ? 0 : 1;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        error instanceof Error
          ? error.stack || error.message
          : String(error)
      );
      process.exitCode = 1;
    });
}

module.exports = {
  buildInstallationDocuments,
  createInstallationSync,
  resolveMongoUri,
  sanitizeError,
  synchronizeVerification,
  upsertInstallationDocuments,
};
