const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildInstallationDocuments,
  resolveMongoUri,
  sanitizeError,
  synchronizeVerification,
  upsertInstallationDocuments,
} = require('./model-installation-sync.cjs');

const registry = {
  artifacts: [
    {
      artifactId: 'fixture-artifact',
      providerId: 'fixture-provider',
      runtimeModelIds: ['runtime-fixture'],
      source: {
        kind: 'huggingface',
        repoId: 'example/fixture',
        revision: 'pinned-revision',
        gated: true,
      },
      destination: 'fixture/cache',
      verification: {
        strategy: 'required-files',
      },
      license: {
        acceptanceRequired: true,
      },
    },
  ],
  modelBindings: [
    {
      modelId: 'fixture-model',
      artifactIds: ['fixture-artifact'],
    },
  ],
};

function verificationRow(overrides = {}) {
  return {
    artifactId: 'fixture-artifact',
    providerId: 'fixture-provider',
    modelIds: ['fixture-model'],
    runtimeModelIds: ['runtime-fixture'],
    sourceKind: 'huggingface',
    sourceRef: 'example/fixture',
    expectedRevision: 'pinned-revision',
    resolvedRevision: 'resolved-revision',
    relativePath: 'fixture/cache',
    verificationStrategy: 'required-files',
    requiredForSuccess: true,
    state: 'verified',
    checks: [
      {
        relativePath: 'a.bin',
        state: 'verified',
        size: 10,
      },
      {
        relativePath: 'b.bin',
        state: 'verified',
        size: 20,
      },
      {
        relativePath: 'virtual-marker',
        state: 'verified',
        size: null,
      },
    ],
    detail: 'all good',
    ...overrides,
  };
}

function verification(overrides = {}) {
  return {
    ok: true,
    modelsRoot: 'models',
    summary: {
      selectedModels: 1,
      selectedArtifacts: 1,
      verified: 1,
      missing: 0,
      corrupt: 0,
      unavailable: 0,
      optionalSkipped: 0,
    },
    artifacts: [
      verificationRow(
        overrides
      ),
    ],
  };
}

class FakeCollection {
  constructor(initial = []) {
    this.rows = new Map(
      initial.map((row) => [
        row.artifactId,
        { ...row },
      ])
    );
  }

  async findOne(filter) {
    return (
      this.rows.get(
        filter.artifactId
      ) || null
    );
  }

  async updateOne(
    filter,
    update,
    options
  ) {
    const existing =
      this.rows.get(
        filter.artifactId
      );

    if (
      !existing &&
      !options?.upsert
    ) {
      return {
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    this.rows.set(
      filter.artifactId,
      {
        ...(existing || {}),
        ...(existing
          ? {}
          : update.$setOnInsert || {}),
        ...(update.$set || {}),
      }
    );

    return {
      matchedCount:
        existing ? 1 : 0,
      modifiedCount: 1,
      upsertedCount:
        existing ? 0 : 1,
    };
  }
}

test('installation projection uses concrete verification evidence only', () => {
  const now =
    new Date(
      '2026-09-24T15:30:00.000Z'
    );

  const [document] =
    buildInstallationDocuments(
      verification(),
      registry,
      now
    );

  assert.equal(
    document.artifactId,
    'fixture-artifact'
  );
  assert.equal(
    document.localPath,
    'fixture/cache'
  );
  assert.equal(
    document.sourceRevision,
    'resolved-revision'
  );
  assert.equal(
    document.fileCount,
    2
  );
  assert.equal(
    document.bytes,
    30
  );
  assert.equal(
    document.status,
    'verified'
  );
  assert.equal(
    document.verifiedAt,
    now
  );
  assert.equal(
    document.licenseAcceptanceRequired,
    true
  );
  assert.equal(
    document.gated,
    true
  );
  assert.equal(
    document.lastError,
    null
  );
});

test('first verified upsert sets installedAt and repeated sync preserves it and lastUsedAt', async () => {
  const first =
    new Date(
      '2026-09-24T15:31:00.000Z'
    );
  const second =
    new Date(
      '2026-09-24T16:00:00.000Z'
    );
  const lastUsedAt =
    new Date(
      '2026-09-24T15:45:00.000Z'
    );
  const collection =
    new FakeCollection();

  const firstDocs =
    buildInstallationDocuments(
      verification(),
      registry,
      first
    );

  await upsertInstallationDocuments(
    collection,
    firstDocs,
    first
  );

  const afterFirst =
    collection.rows.get(
      'fixture-artifact'
    );

  assert.equal(
    afterFirst.installedAt,
    first
  );
  assert.equal(
    afterFirst.verifiedAt,
    first
  );
  assert.equal(
    afterFirst.createdAt,
    first
  );

  afterFirst.lastUsedAt =
    lastUsedAt;

  const secondDocs =
    buildInstallationDocuments(
      verification(),
      registry,
      second
    );

  await upsertInstallationDocuments(
    collection,
    secondDocs,
    second
  );

  const afterSecond =
    collection.rows.get(
      'fixture-artifact'
    );

  assert.equal(
    afterSecond.installedAt,
    first
  );
  assert.equal(
    afterSecond.verifiedAt,
    second
  );
  assert.equal(
    afterSecond.lastUsedAt,
    lastUsedAt
  );
  assert.equal(
    afterSecond.createdAt,
    first
  );
  assert.equal(
    afterSecond.updatedAt,
    second
  );
});

test('later missing observation preserves installedAt and stores sanitized error', async () => {
  const installedAt =
    new Date(
      '2026-09-24T14:00:00.000Z'
    );
  const lastUsedAt =
    new Date(
      '2026-09-24T14:30:00.000Z'
    );
  const now =
    new Date(
      '2026-09-24T17:00:00.000Z'
    );
  const collection =
    new FakeCollection([
      {
        artifactId:
          'fixture-artifact',
        installedAt,
        lastUsedAt,
        createdAt:
          new Date(
            '2026-09-24T13:00:00.000Z'
          ),
        status: 'verified',
        lastError: null,
      },
    ]);

  const missing =
    verification({
      state: 'missing',
      resolvedRevision: null,
      checks: [],
      detail:
        'password=super-secret https://user:secret@example.test/path',
    });

  missing.ok = false;
  missing.summary.verified = 0;
  missing.summary.missing = 1;

  const documents =
    buildInstallationDocuments(
      missing,
      registry,
      now
    );

  await upsertInstallationDocuments(
    collection,
    documents,
    now
  );

  const row =
    collection.rows.get(
      'fixture-artifact'
    );

  assert.equal(
    row.status,
    'missing'
  );
  assert.equal(
    row.installedAt,
    installedAt
  );
  assert.equal(
    row.lastUsedAt,
    lastUsedAt
  );
  assert.equal(
    row.verifiedAt,
    null
  );
  assert.doesNotMatch(
    row.lastError,
    /super-secret|user:secret/
  );
  assert.equal(
    row.lastError.includes('password=***'),
    true
  );
});

test('successful verification clears stale lastError', async () => {
  const now =
    new Date(
      '2026-09-24T18:00:00.000Z'
    );
  const installedAt =
    new Date(
      '2026-09-24T14:00:00.000Z'
    );
  const collection =
    new FakeCollection([
      {
        artifactId:
          'fixture-artifact',
        installedAt,
        lastUsedAt: null,
        createdAt: installedAt,
        status: 'failed',
        lastError:
          'old failure',
      },
    ]);

  const documents =
    buildInstallationDocuments(
      verification(),
      registry,
      now
    );

  await upsertInstallationDocuments(
    collection,
    documents,
    now
  );

  const row =
    collection.rows.get(
      'fixture-artifact'
    );

  assert.equal(
    row.status,
    'verified'
  );
  assert.equal(
    row.lastError,
    null
  );
  assert.equal(
    row.installedAt,
    installedAt
  );
});

test('Mongo outage is advisory unless requireDb is set', async () => {
  const connectMongo =
    async () => {
      throw new Error(
        'mongodb://user:secret@127.0.0.1 unavailable'
      );
    };

  const advisory =
    await synchronizeVerification(
      verification(),
      {
        registry,
        uri:
          'mongodb://fixture',
        connectMongo,
        requireDb: false,
      }
    );

  assert.equal(
    advisory.status,
    'unavailable'
  );
  assert.equal(
    advisory.synchronized,
    false
  );
  assert.equal(
    advisory.warning,
    'MongoDB synchronization unavailable; filesystem verification remains authoritative.'
  );
  assert.doesNotMatch(
    advisory.warning,
    /mongodb:\/\/|user:secret|127\.0\.0\.1|localhost|:\d{2,5}\b/i
  );

  await assert.rejects(
    synchronizeVerification(
      verification(),
      {
        registry,
        uri:
          'mongodb://fixture',
        connectMongo,
        requireDb: true,
      }
    ),
    (error) => {
      assert.equal(
        error.message,
        'MongoDB synchronization unavailable; filesystem verification remains authoritative.'
      );
      assert.doesNotMatch(
        error.message,
        /mongodb:\/\/|user:secret|127\.0\.0\.1|localhost|:\d{2,5}\b/i
      );
      return true;
    }
  );
});

test('Mongo URI resolution prefers explicit URI and safely constructs local app URI', () => {
  assert.equal(
    resolveMongoUri(
      {
        MONGODB_URI:
          'mongodb://env-file',
        MONGO_HARMONIA_PASSWORD:
          'file-password',
      },
      {
        MONGODB_URI:
          'mongodb://process',
      }
    ),
    'mongodb://process'
  );

  assert.equal(
    resolveMongoUri(
      {
        MONGO_HARMONIA_PASSWORD:
          'p@ss:/ word',
      },
      {}
    ),
    'mongodb://harmonia_app:p%40ss%3A%2F%20word@127.0.0.1:27017/harmonia?authSource=harmonia'
  );

  assert.equal(
    resolveMongoUri({}, {}),
    null
  );
});

test('error sanitizer removes URI userinfo and token-like values', () => {
  const value =
    sanitizeError(
      'HF_TOKEN=abc123 mongodb://user:secret@localhost/x authorization=Bearer-thing'
    );

  assert.doesNotMatch(
    value,
    /abc123|user:secret|Bearer-thing/
  );
  assert.equal(
    value.includes('HF_TOKEN=***'),
    true
  );
});


test('package exposes installation metadata sync commands', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'package.json'),
      'utf8'
    )
  );

  assert.equal(
    pkg.scripts['models:db-sync'],
    'node scripts/model-installation-sync.cjs'
  );
  assert.equal(
    pkg.scripts['test:model-installations'],
    'node --test scripts/model-installation-sync.test.cjs'
  );
});
