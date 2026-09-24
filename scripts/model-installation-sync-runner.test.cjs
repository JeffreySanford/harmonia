const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyDatabaseRequirement,
  buildSyncArgs,
  lifecycleDatabaseState,
  runLifecycleDatabaseSync,
} = require('./model-installation-sync-runner.cjs');

test('sync runner forwards root selectors and require-db without secrets', () => {
  const args = buildSyncArgs({
    root: 'models',
    modelIds: ['musicgen-small'],
    providerIds: ['musicgen'],
    artifactIds: ['musicgen-small'],
    requireDb: true,
  });

  assert.deepEqual(
    args.slice(1),
    [
      '--root',
      'models',
      '--model',
      'musicgen-small',
      '--provider',
      'musicgen',
      '--artifact',
      'musicgen-small',
      '--require-db',
      '--json',
    ]
  );

  assert.equal(
    args.some(
      (value) =>
        /token|password|mongodb:\/\//i.test(
          value
        )
    ),
    false
  );
});

test('successful lifecycle runs database sync exactly once', () => {
  let calls = 0;

  const state =
    lifecycleDatabaseState(
      {
        ok: true,
      },
      {
        root: 'models',
        modelIds: ['musicgen-small'],
      },
      (
        executable,
        args,
        options
      ) => {
        calls += 1;

        assert.equal(
          executable,
          process.execPath
        );
        assert.equal(
          args.includes('--json'),
          true
        );
        assert.equal(
          options.stdio[1],
          'pipe'
        );

        return JSON.stringify({
          database: {
            status:
              'synchronized',
            synchronized: true,
            records: [
              {
                artifactId:
                  'musicgen-small',
              },
            ],
            warning: null,
          },
        });
      }
    );

  assert.equal(calls, 1);
  assert.deepEqual(
    state,
    {
      status: 'synchronized',
      synchronized: true,
      records: 1,
      warning: null,
      required: false,
    }
  );
});

test('dry-run lifecycle skips database sync', () => {
  let calls = 0;

  const state =
    lifecycleDatabaseState(
      {
        ok: true,
      },
      {
        dryRun: true,
      },
      () => {
        calls += 1;
      }
    );

  assert.equal(calls, 0);
  assert.equal(
    state.status,
    'skipped-dry-run'
  );
});

test('alternate model root skips automatic database sync', () => {
  let calls = 0;

  const state =
    lifecycleDatabaseState(
      {
        ok: true,
      },
      {
        root:
          'generated/model-manager/recovery/models',
      },
      () => {
        calls += 1;
      }
    );

  assert.equal(calls, 0);
  assert.equal(
    state.status,
    'skipped-noncanonical-root'
  );
  assert.equal(
    state.required,
    false
  );
});

test('failed lifecycle skips database sync', () => {
  let calls = 0;

  const state =
    lifecycleDatabaseState(
      {
        ok: false,
      },
      {},
      () => {
        calls += 1;
      }
    );

  assert.equal(calls, 0);
  assert.equal(
    state.status,
    'skipped-lifecycle-failed'
  );
});

test('sync runner converts child failure into secret-safe advisory status', () => {
  const state =
    runLifecycleDatabaseSync(
      {
        requireDb: false,
      },
      () => {
        const error =
          new Error(
            'mongodb://user:secret@localhost failure'
          );
        error.stderr =
          'HF_TOKEN=secret';
        throw error;
      }
    );

  assert.equal(
    state.status,
    'unavailable'
  );
  assert.equal(
    state.synchronized,
    false
  );
  assert.equal(
    state.required,
    false
  );
  assert.doesNotMatch(
    state.warning,
    /secret|mongodb:\/\//i
  );
});

test('required database failure marks lifecycle result failed without changing filesystem result details', () => {
  const lifecycle = {
    ok: true,
    summary: {
      downloaded: 1,
    },
    warnings: [],
  };

  const updated =
    applyDatabaseRequirement(
      lifecycle,
      {
        status: 'unavailable',
        synchronized: false,
        records: 0,
        warning:
          'MongoDB metadata synchronization could not be completed.',
        required: true,
      }
    );

  assert.equal(
    updated.ok,
    false
  );
  assert.equal(
    updated.summary.downloaded,
    1
  );
  assert.equal(
    updated.databaseIntegration.required,
    true
  );
  assert.match(
    updated.warnings[0],
    /MongoDB metadata synchronization/
  );
});

test('advisory database failure preserves successful lifecycle result', () => {
  const lifecycle = {
    ok: true,
    warnings: [],
  };

  const updated =
    applyDatabaseRequirement(
      lifecycle,
      {
        status: 'unavailable',
        synchronized: false,
        records: 0,
        warning:
          'MongoDB metadata synchronization could not be completed.',
        required: false,
      }
    );

  assert.equal(
    updated.ok,
    true
  );
  assert.equal(
    updated.databaseIntegration.status,
    'unavailable'
  );
});
