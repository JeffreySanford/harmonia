const assert =
  require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const {
  tmpdir,
} = require('node:os');
const path =
  require('node:path');
const {
  test,
} = require('node:test');

const {
  appProjectsToStart,
  isHarmoniaBackendHealth,
  isHarmoniaFrontendHtml,
  workerBuildFingerprint,
  workerStartupDecision,
} = require('./start-all-state.cjs');

test(
  'worker build fingerprint changes when a baked input changes',
  () => {
    const root =
      mkdtempSync(
        path.join(
          tmpdir(),
          'harmonia-worker-fingerprint-'
        )
      );

    try {
      mkdirSync(
        path.join(
          root,
          'scripts'
        ),
        {
          recursive: true,
        }
      );

      writeFileSync(
        path.join(
          root,
          'Dockerfile.worker'
        ),
        'FROM test\n'
      );

      writeFileSync(
        path.join(
          root,
          'requirements.worker.txt'
        ),
        'one==1\n'
      );

      writeFileSync(
        path.join(
          root,
          'entrypoint.sh'
        ),
        '#!/bin/sh\n'
      );

      writeFileSync(
        path.join(
          root,
          'scripts',
          'provider.py'
        ),
        'print("one")\n'
      );

      const first =
        workerBuildFingerprint(
          root
        );

      writeFileSync(
        path.join(
          root,
          'scripts',
          'provider.py'
        ),
        'print("two")\n'
      );

      const second =
        workerBuildFingerprint(
          root
        );

      assert.match(
        first,
        /^[a-f0-9]{64}$/
      );

      assert.notEqual(
        first,
        second
      );
    } finally {
      rmSync(
        root,
        {
          recursive: true,
          force: true,
        }
      );
    }
  }
);

test(
  'healthy worker with current image and fingerprint skips build',
  () => {
    const docker =
      (args) => {
        const command =
          args.join(' ');

        if (
          command.startsWith(
            'image ls'
          )
        ) {
          return 'image-present\n';
        }

        if (
          command.startsWith(
            'image inspect'
          )
        ) {
          return 'sha256:current\n';
        }

        if (
          command.startsWith(
            'ps --all'
          )
        ) {
          return (
            'harmonia-worker|worker-id\n'
          );
        }

        if (
          command.startsWith(
            'inspect --format'
          )
        ) {
          return JSON.stringify({
            Image:
              'sha256:current',
            State: {
              Running: true,
              Health: {
                Status:
                  'healthy',
              },
            },
          });
        }

        throw new Error(
          'Unexpected docker call: ' +
          command
        );
      };

    assert.deepEqual(
      workerStartupDecision({
        docker,
        currentFingerprint:
          'same',
        recordedFingerprint:
          'same',
      }),
      {
        clean: true,
        build: false,
        reason:
          'running-current-healthy',
      }
    );
  }
);

test(
  'changed worker build inputs require rebuild',
  () => {
    const docker =
      (args) => {
        const command =
          args.join(' ');

        if (
          command.startsWith(
            'image ls'
          )
        ) {
          return 'image-present\n';
        }

        if (
          command.startsWith(
            'image inspect'
          )
        ) {
          return 'sha256:current\n';
        }

        throw new Error(
          'Unexpected docker call: ' +
          command
        );
      };

    const result =
      workerStartupDecision({
        docker,
        currentFingerprint:
          'new',
        recordedFingerprint:
          'old',
      });

    assert.equal(
      result.build,
      true
    );

    assert.equal(
      result.reason,
      'worker-build-inputs-changed'
    );
  }
);

test(
  'Harmonia frontend and backend identity checks are specific',
  () => {
    assert.equal(
      isHarmoniaBackendHealth({
        ok: true,
      }),
      true
    );

    assert.equal(
      isHarmoniaBackendHealth({
        status: 'ok',
      }),
      false
    );

    assert.equal(
      isHarmoniaFrontendHtml(
        '<title>Harmonia - Test</title><harmonia-root></harmonia-root>'
      ),
      true
    );

    assert.equal(
      isHarmoniaFrontendHtml(
        '<title>Other App</title><app-root></app-root>'
      ),
      false
    );
  }
);

test(
  'only missing Harmonia app servers are started',
  () => {
    assert.deepEqual(
      appProjectsToStart({
        frontend: true,
        backend: true,
      }),
      []
    );

    assert.deepEqual(
      appProjectsToStart({
        frontend: true,
        backend: false,
      }),
      [
        'backend',
      ]
    );

    assert.deepEqual(
      appProjectsToStart({
        frontend: false,
        backend: true,
      }),
      [
        'frontend',
      ]
    );

    assert.deepEqual(
      appProjectsToStart({
        frontend: false,
        backend: false,
      }),
      [
        'frontend',
        'backend',
      ]
    );
  }
);
