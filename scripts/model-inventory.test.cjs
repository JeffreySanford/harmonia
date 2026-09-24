const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  INVENTORY_SCHEMA_VERSION,
  buildInventory,
  containsAbsoluteLocalPath,
  sanitizeDetail,
  writeInventoryFiles,
} = require('./model-inventory.cjs');

const registry = {
  schemaVersion:
    'harmonia-model-registry-v1',
  modelsRoot: 'models',
  artifacts: [
    {
      artifactId:
        'verified-artifact',
      providerId:
        'fixture-provider',
      runtimeModelIds: [
        'fixture/runtime',
      ],
      source: {
        kind: 'huggingface',
        repoId:
          'example/verified',
        revision:
          'abc123',
        gated: true,
      },
      destination:
        'fixture/verified',
      verification: {
        strategy:
          'required-files',
      },
      defaultInstall: true,
    },
    {
      artifactId:
        'missing-artifact',
      providerId:
        'fixture-provider',
      runtimeModelIds: [
        'fixture/missing',
      ],
      source: {
        kind: 'huggingface',
        repoId:
          'example/missing',
        revision: null,
        gated: false,
      },
      destination:
        'fixture/missing',
      verification: {
        strategy:
          'required-files',
      },
      defaultInstall: false,
    },
  ],
};

function verification() {
  return {
    ok: true,
    modelsRoot:
      'D:/repos/harmonia/models',
    summary: {
      selectedModels: 2,
      selectedArtifacts: 2,
      verified: 1,
      missing: 1,
      corrupt: 0,
      unavailable: 0,
      optionalSkipped: 1,
    },
    artifacts: [
      {
        artifactId:
          'verified-artifact',
        providerId:
          'fixture-provider',
        modelIds: [
          'fixture-model',
        ],
        runtimeModelIds: [
          'fixture/runtime',
        ],
        sourceKind:
          'huggingface',
        sourceRef:
          'example/verified',
        expectedRevision:
          'abc123',
        resolvedRevision:
          'resolved456',
        relativePath:
          'fixture/verified',
        verificationStrategy:
          'required-files',
        defaultInstall: true,
        requiredForSuccess: true,
        state: 'verified',
        checks: [
          {
            relativePath:
              'a.bin',
            size: 10,
          },
          {
            relativePath:
              'b.bin',
            size: 20,
          },
          {
            relativePath:
              'virtual',
            size: null,
          },
        ],
        detail:
          'verified D:/repos/harmonia/models/fixture/verified',
      },
      {
        artifactId:
          'missing-artifact',
        providerId:
          'fixture-provider',
        modelIds: [
          'fixture-optional',
        ],
        runtimeModelIds: [
          'fixture/missing',
        ],
        sourceKind:
          'huggingface',
        sourceRef:
          'example/missing',
        expectedRevision: null,
        resolvedRevision: null,
        relativePath:
          'fixture/missing',
        verificationStrategy:
          'required-files',
        defaultInstall: false,
        requiredForSuccess: false,
        state: 'missing',
        checks: [],
        detail:
          'required files are missing',
      },
    ],
  };
}

test('portable inventory projects verification evidence without absolute paths', () => {
  const generatedAt =
    new Date(
      '2026-09-24T20:00:00.000Z'
    );

  const result =
    buildInventory(
      verification(),
      {
        registry,
        generatedAt,
        observedRoot:
          'D:/repos/harmonia/models',
      }
    );

  assert.equal(
    result.schemaVersion,
    INVENTORY_SCHEMA_VERSION
  );
  assert.equal(
    result.modelsRoot,
    'models'
  );
  assert.equal(
    result.artifacts.length,
    2
  );

  const verified =
    result.artifacts[0];

  assert.deepEqual(
    {
      sourceRevision:
        verified.sourceRevision,
      filesCount:
        verified.filesCount,
      sizeBytes:
        verified.sizeBytes,
      status:
        verified.status,
      verifiedAt:
        verified.verifiedAt,
      detail:
        verified.detail,
    },
    {
      sourceRevision:
        'resolved456',
      filesCount: 2,
      sizeBytes: 30,
      status: 'verified',
      verifiedAt:
        '2026-09-24T20:00:00.000Z',
      detail:
        'verified <modelsRoot>/fixture/verified',
    }
  );

  assert.equal(
    containsAbsoluteLocalPath(
      JSON.stringify(result)
    ),
    false
  );
});

test('optional missing artifact remains represented without verified timestamp', () => {
  const result =
    buildInventory(
      verification(),
      {
        registry,
        generatedAt:
          new Date(
            '2026-09-24T20:00:00.000Z'
          ),
        observedRoot:
          'D:/repos/harmonia/models',
      }
    );

  const missing =
    result.artifacts.find(
      (row) =>
        row.artifactId ===
        'missing-artifact'
    );

  assert.ok(missing);
  assert.equal(
    missing.status,
    'missing'
  );
  assert.equal(
    missing.requiredForSuccess,
    false
  );
  assert.equal(
    missing.filesCount,
    0
  );
  assert.equal(
    missing.sizeBytes,
    0
  );
  assert.equal(
    missing.verifiedAt,
    null
  );
});

test('inventory summary aggregates concrete evidence only', () => {
  const result =
    buildInventory(
      verification(),
      {
        registry,
        generatedAt:
          new Date(
            '2026-09-24T20:00:00.000Z'
          ),
        observedRoot:
          'D:/repos/harmonia/models',
      }
    );

  assert.equal(
    result.summary.filesCount,
    2
  );
  assert.equal(
    result.summary.sizeBytes,
    30
  );
  assert.equal(
    result.summary.verified,
    1
  );
  assert.equal(
    result.summary.missing,
    1
  );
});

test('detail sanitizer removes observed root variants', () => {
  assert.equal(
    sanitizeDetail(
      'problem at D:/repos/harmonia/models/musicgen/cache',
      'D:/repos/harmonia/models'
    ),
    'problem at <modelsRoot>/musicgen/cache'
  );
});

test('absolute local path detector rejects Windows and common Unix roots', () => {
  assert.equal(
    containsAbsoluteLocalPath(
      'D:/repos/harmonia/models/x'
    ),
    true
  );
  assert.equal(
    containsAbsoluteLocalPath(
      '/mnt/d/repos/harmonia/models/x'
    ),
    true
  );
  assert.equal(
    containsAbsoluteLocalPath(
      'musicgen/huggingface'
    ),
    false
  );
});

test('inventory writer produces stable and timestamped identical JSON files', () => {
  const temporary =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'harmonia-inventory-'
      )
    );

  try {
    const inventory =
      buildInventory(
        verification(),
        {
          registry,
          generatedAt:
            new Date(
              '2026-09-24T20:00:00.000Z'
            ),
          observedRoot:
            'D:/repos/harmonia/models',
        }
      );

    const paths =
      writeInventoryFiles(
        inventory,
        {
          outputRoot:
            temporary,
        }
      );

    assert.equal(
      path.basename(
        paths.stablePath
      ),
      'model-inventory.json'
    );
    assert.equal(
      path.basename(
        paths.timestampedPath
      ),
      '2026-09-24T20-00-00-000Z-inventory.json'
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          paths.stablePath,
          'utf8'
        )
      ),
      inventory
    );

    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          paths.timestampedPath,
          'utf8'
        )
      ),
      inventory
    );
  } finally {
    fs.rmSync(
      temporary,
      {
        recursive: true,
        force: true,
      }
    );
  }
});
