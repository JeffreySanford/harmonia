const assert =
  require('node:assert/strict');

const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} =
  require('node:fs');

const {
  tmpdir,
} =
  require('node:os');

const path =
  require('node:path');

const {
  test,
} =
  require('node:test');

const state =
  require('./start-all-state.cjs');

function requireFunction(
  name
) {
  assert.equal(
    typeof state[name],
    'function',
    `${name} must be exported by start-all-state.cjs`
  );

  return state[name];
}

function fixture() {
  const root =
    mkdtempSync(
      path.join(
        tmpdir(),
        'harmonia-app-freshness-'
      )
    );

  const write =
    (
      relativePath,
      content
    ) => {
      const file =
        path.join(
          root,
          relativePath
        );

      mkdirSync(
        path.dirname(file),
        {
          recursive:
            true,
        }
      );

      writeFileSync(
        file,
        content,
        'utf8'
      );
    };

  /*
   * Workspace-level inputs that can affect both application
   * builds and dependency resolution.
   */
  write(
    'package.json',
    '{"name":"fixture"}\n'
  );

  write(
    'pnpm-lock.yaml',
    'lockfileVersion: test\n'
  );

  write(
    'pnpm-workspace.yaml',
    'packages:\n  - apps/*\n'
  );

  write(
    'nx.json',
    '{"extends":"nx/presets/npm.json"}\n'
  );

  write(
    'tsconfig.base.json',
    '{"compilerOptions":{}}\n'
  );

  write(
    'tsconfig.json',
    '{"extends":"./tsconfig.base.json"}\n'
  );

  /*
   * Backend application inputs.
   */
  write(
    'apps/backend/project.json',
    '{"name":"backend"}\n'
  );

  write(
    'apps/backend/webpack.config.js',
    'module.exports = {};\n'
  );

  write(
    'apps/backend/src/main.ts',
    'console.log("backend-one");\n'
  );

  /*
   * Frontend application inputs.
   */
  write(
    'apps/frontend/project.json',
    '{"name":"frontend"}\n'
  );

  write(
    'apps/frontend/src/main.ts',
    'console.log("frontend-one");\n'
  );

  return {
    root,
    write,
    cleanup() {
      rmSync(
        root,
        {
          recursive:
            true,
          force:
            true,
        }
      );
    },
  };
}

test(
  'application source fingerprint API is explicit and project-scoped',
  () => {
    requireFunction(
      'applicationSourceInputs'
    );

    requireFunction(
      'applicationSourceFingerprint'
    );

    requireFunction(
      'readApplicationSourceFingerprint'
    );

    requireFunction(
      'writeApplicationSourceFingerprint'
    );

    requireFunction(
      'applicationStartupDecision'
    );
  }
);

test(
  'backend source changes invalidate the backend fingerprint',
  () => {
    const fingerprint =
      requireFunction(
        'applicationSourceFingerprint'
      );

    const fx =
      fixture();

    try {
      const before =
        fingerprint(
          fx.root,
          'backend'
        );

      fx.write(
        'apps/backend/src/main.ts',
        'console.log("backend-two");\n'
      );

      const after =
        fingerprint(
          fx.root,
          'backend'
        );

      assert.match(
        before,
        /^[a-f0-9]{64}$/
      );

      assert.match(
        after,
        /^[a-f0-9]{64}$/
      );

      assert.notEqual(
        before,
        after
      );
    } finally {
      fx.cleanup();
    }
  }
);

test(
  'frontend source changes invalidate only the frontend project fingerprint',
  () => {
    const fingerprint =
      requireFunction(
        'applicationSourceFingerprint'
      );

    const fx =
      fixture();

    try {
      const backendBefore =
        fingerprint(
          fx.root,
          'backend'
        );

      const frontendBefore =
        fingerprint(
          fx.root,
          'frontend'
        );

      fx.write(
        'apps/frontend/src/main.ts',
        'console.log("frontend-two");\n'
      );

      const backendAfter =
        fingerprint(
          fx.root,
          'backend'
        );

      const frontendAfter =
        fingerprint(
          fx.root,
          'frontend'
        );

      assert.equal(
        backendAfter,
        backendBefore
      );

      assert.notEqual(
        frontendAfter,
        frontendBefore
      );
    } finally {
      fx.cleanup();
    }
  }
);

test(
  'workspace dependency changes invalidate both application fingerprints',
  () => {
    const fingerprint =
      requireFunction(
        'applicationSourceFingerprint'
      );

    const fx =
      fixture();

    try {
      const backendBefore =
        fingerprint(
          fx.root,
          'backend'
        );

      const frontendBefore =
        fingerprint(
          fx.root,
          'frontend'
        );

      fx.write(
        'pnpm-lock.yaml',
        'lockfileVersion: changed\n'
      );

      assert.notEqual(
        fingerprint(
          fx.root,
          'backend'
        ),
        backendBefore
      );

      assert.notEqual(
        fingerprint(
          fx.root,
          'frontend'
        ),
        frontendBefore
      );
    } finally {
      fx.cleanup();
    }
  }
);

test(
  'generated evidence and dependency directories are not application source inputs',
  () => {
    const inputs =
      requireFunction(
        'applicationSourceInputs'
      );

    const fx =
      fixture();

    try {
      fx.write(
        'apps/backend/node_modules/package/index.js',
        'ignored\n'
      );

      fx.write(
        'apps/backend/dist/generated.js',
        'ignored\n'
      );

      fx.write(
        'apps/backend/.angular/cache/value',
        'ignored\n'
      );

      fx.write(
        'generated/evidence/start-all/noise.txt',
        'ignored\n'
      );

      const backendInputs =
        inputs(
          fx.root,
          'backend'
        );

      assert.ok(
        Array.isArray(
          backendInputs
        )
      );

      assert.ok(
        backendInputs.some(
          (
            item
          ) =>
            item.replaceAll(
              '\\',
              '/'
            ) ===
            'apps/backend/src/main.ts'
        )
      );

      for (
        const item of
        backendInputs
      ) {
        const normalized =
          item.replaceAll(
            '\\',
            '/'
          );

        assert.doesNotMatch(
          normalized,
          /(?:^|\/)(?:node_modules|dist|\.angular|generated)(?:\/|$)/
        );
      }
    } finally {
      fx.cleanup();
    }
  }
);

test(
  'application source fingerprint persistence is separate per project',
  () => {
    const readFingerprint =
      requireFunction(
        'readApplicationSourceFingerprint'
      );

    const writeFingerprint =
      requireFunction(
        'writeApplicationSourceFingerprint'
      );

    const fx =
      fixture();

    try {
      assert.equal(
        readFingerprint(
          fx.root,
          'backend'
        ),
        null
      );

      assert.equal(
        readFingerprint(
          fx.root,
          'frontend'
        ),
        null
      );

      writeFingerprint(
        fx.root,
        'backend',
        'backend-fingerprint'
      );

      writeFingerprint(
        fx.root,
        'frontend',
        'frontend-fingerprint'
      );

      assert.equal(
        readFingerprint(
          fx.root,
          'backend'
        ),
        'backend-fingerprint'
      );

      assert.equal(
        readFingerprint(
          fx.root,
          'frontend'
        ),
        'frontend-fingerprint'
      );

      const backendMarker =
        path.join(
          fx.root,
          'generated',
          'evidence',
          'start-all',
          'backend-source-fingerprint.txt'
        );

      const frontendMarker =
        path.join(
          fx.root,
          'generated',
          'evidence',
          'start-all',
          'frontend-source-fingerprint.txt'
        );

      assert.equal(
        readFileSync(
          backendMarker,
          'utf8'
        ).trim(),
        'backend-fingerprint'
      );

      assert.equal(
        readFileSync(
          frontendMarker,
          'utf8'
        ).trim(),
        'frontend-fingerprint'
      );
    } finally {
      fx.cleanup();
    }
  }
);

test(
  'non-running application starts regardless of fingerprint baseline',
  () => {
    const decide =
      requireFunction(
        'applicationStartupDecision'
      );

    assert.deepEqual(
      decide({
        running:
          false,

        currentFingerprint:
          'current',

        recordedFingerprint:
          null,
      }),
      {
        action:
          'start',

        reason:
          'not-running',
      }
    );
  }
);

test(
  'healthy running application is reused only when its fingerprint matches',
  () => {
    const decide =
      requireFunction(
        'applicationStartupDecision'
      );

    assert.deepEqual(
      decide({
        running:
          true,

        currentFingerprint:
          'same',

        recordedFingerprint:
          'same',
      }),
      {
        action:
          'reuse',

        reason:
          'running-current',
      }
    );
  }
);

test(
  'healthy application without a fingerprint baseline is stale and must restart',
  () => {
    const decide =
      requireFunction(
        'applicationStartupDecision'
      );

    assert.deepEqual(
      decide({
        running:
          true,

        currentFingerprint:
          'current',

        recordedFingerprint:
          null,
      }),
      {
        action:
          'restart',

        reason:
          'fingerprint-baseline-missing',
      }
    );
  }
);

test(
  'healthy application with changed source is stale and must restart',
  () => {
    const decide =
      requireFunction(
        'applicationStartupDecision'
      );

    assert.deepEqual(
      decide({
        running:
          true,

        currentFingerprint:
          'new',

        recordedFingerprint:
          'old',
      }),
      {
        action:
          'restart',

        reason:
          'source-fingerprint-changed',
      }
    );
  }
);
