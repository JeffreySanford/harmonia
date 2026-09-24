#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mongoContainer = 'harmonia-mongo-i9';

const validator = {
  $jsonSchema: {
    bsonType: 'object',
    additionalProperties: false,
    required: [
      'artifactId',
      'providerId',
      'modelIds',
      'runtimeModelIds',
      'sourceKind',
      'sourceRef',
      'localPath',
      'status',
      'verificationStrategy',
      'licenseAcceptanceRequired',
      'gated',
    ],
    properties: {
      _id: { bsonType: 'objectId' },
      artifactId: { bsonType: 'string' },
      providerId: { bsonType: 'string' },
      modelIds: {
        bsonType: 'array',
        items: { bsonType: 'string' },
      },
      runtimeModelIds: {
        bsonType: 'array',
        items: { bsonType: 'string' },
      },
      sourceKind: {
        enum: ['huggingface', 'http-zip'],
      },
      sourceRef: { bsonType: 'string' },
      sourceRevision: {
        bsonType: ['string', 'null'],
      },
      localPath: {
        bsonType: 'string',
        pattern: '^(?!/)(?![A-Za-z]:[\\\\/]).+',
      },
      status: {
        enum: [
          'missing',
          'verified',
          'degraded',
          'corrupt',
          'unavailable',
          'failed',
        ],
      },
      fileCount: {
        bsonType: 'number',
        minimum: 0,
      },
      bytes: {
        bsonType: 'number',
        minimum: 0,
      },
      verificationStrategy: {
        bsonType: 'string',
      },
      verifiedAt: {
        bsonType: ['date', 'null'],
      },
      installedAt: {
        bsonType: ['date', 'null'],
      },
      lastUsedAt: {
        bsonType: ['date', 'null'],
      },
      licenseAcceptanceRequired: {
        bsonType: 'bool',
      },
      gated: {
        bsonType: 'bool',
      },
      lastError: {
        bsonType: ['string', 'null'],
      },
      createdAt: {
        bsonType: 'date',
      },
      updatedAt: {
        bsonType: 'date',
      },
    },
  },
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture
      ? ['ignore', 'pipe', 'pipe']
      : 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw new Error(
      `Cannot run ${command}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const details = options.capture
      ? [result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n')
          .trim()
      : '';

    throw new Error(
      `${command} failed with status ${result.status}` +
        (details ? `: ${details}` : '')
    );
  }

  return result.stdout || '';
}

function ensureMongoContainer() {
  const name = run(
    'docker',
    [
      'inspect',
      '--format',
      '{{.Name}}',
      mongoContainer,
    ],
    { capture: true }
  ).trim();

  if (name !== `/${mongoContainer}`) {
    throw new Error(
      `Expected Docker container ${mongoContainer}, got ${name || 'none'}`
    );
  }
}

function main() {
  ensureMongoContainer();

  const validatorJson =
    JSON.stringify(validator);

  const script = [
    'const admin = db.getSiblingDB("admin");',
    'if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {',
    '  print("ROOT_AUTH_FAILED");',
    '  quit(2);',
    '}',
    'const h = db.getSiblingDB("harmonia");',
    `const validator = ${validatorJson};`,
    'if (h.getCollectionNames().includes("model_installations")) {',
    '  const result = h.runCommand({',
    '    collMod: "model_installations",',
    '    validator,',
    '    validationLevel: "strict",',
    '    validationAction: "error"',
    '  });',
    '  if (!result.ok) {',
    '    printjson(result);',
    '    quit(3);',
    '  }',
    '  print("MODEL_INSTALLATIONS_VALIDATOR_UPDATED");',
    '} else {',
    '  h.createCollection("model_installations", {',
    '    validator,',
    '    validationLevel: "strict",',
    '    validationAction: "error"',
    '  });',
    '  print("MODEL_INSTALLATIONS_COLLECTION_CREATED");',
    '}',
    'const collection = h.getCollection("model_installations");',
    'collection.createIndex({ artifactId: 1 }, { unique: true });',
    'collection.createIndex({ providerId: 1, status: 1 });',
    'collection.createIndex({ status: 1, verifiedAt: -1 });',
    'collection.createIndex({ modelIds: 1 });',
    'print("MODEL_INSTALLATIONS_SCHEMA_SYNC_OK");',
  ].join('\n');

  run('docker', [
    'exec',
    mongoContainer,
    'mongosh',
    '--quiet',
    '--eval',
    script,
  ]);
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );
  process.exitCode = 1;
}
