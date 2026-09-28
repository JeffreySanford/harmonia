const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const {
  test,
} =
  require('node:test');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const startAllPath =
  path.join(
    root,
    'scripts',
    'start-all.cjs'
  );

const packagePath =
  path.join(
    root,
    'package.json'
  );

const startAll =
  fs.readFileSync(
    startAllPath,
    'utf8'
  );

const pkg =
  JSON.parse(
    fs.readFileSync(
      packagePath,
      'utf8'
    )
  );

test(
  'start:all imports the application freshness state boundary',
  () => {
    for (
      const name of
      [
        'applicationSourceFingerprint',
        'applicationStartupDecision',
        'readApplicationSourceFingerprint',
        'writeApplicationSourceFingerprint',
      ]
    ) {
      assert.match(
        startAll,
        new RegExp(
          String.raw`\b${name}\b`
        ),
        `${name} must be wired into start-all.cjs`
      );
    }
  }
);

test(
  'start:all computes current backend and frontend source fingerprints',
  () => {
    assert.match(
      startAll,
      /applicationSourceFingerprint\(\s*root\s*,\s*['"]backend['"]\s*\)/
    );

    assert.match(
      startAll,
      /applicationSourceFingerprint\(\s*root\s*,\s*['"]frontend['"]\s*\)/
    );
  }
);

test(
  'running application reuse is decided from health plus its recorded source fingerprint',
  () => {
    assert.match(
      startAll,
      /readApplicationSourceFingerprint\(\s*root\s*,\s*['"]backend['"]\s*\)/
    );

    assert.match(
      startAll,
      /readApplicationSourceFingerprint\(\s*root\s*,\s*['"]frontend['"]\s*\)/
    );

    assert.match(
      startAll,
      /applicationStartupDecision\(\s*\{[\s\S]*?running\s*:[\s\S]*?currentFingerprint\s*:[\s\S]*?recordedFingerprint\s*:/m
    );
  }
);

test(
  'stale running applications fail closed instead of being silently reused or killed',
  () => {
    assert.match(
      startAll,
      /action\s*===\s*['"]restart['"]/
    );

    assert.match(
      startAll,
      /RESTART REQUIRED/
    );

    assert.match(
      startAll,
      /stop[\s\S]*Harmonia[\s\S]*server[\s\S]*rerun/i
    );

    /*
     * M19 source freshness must not gain authority to kill
     * arbitrary host processes. Automatic managed restart can
     * be added later behind a stronger ownership boundary.
     */
    assert.doesNotMatch(
      startAll,
      /\btaskkill(?:\.exe)?\b/i
    );

    assert.doesNotMatch(
      startAll,
      /\bStop-Process\b/i
    );

    assert.doesNotMatch(
      startAll,
      /\bprocess\.kill\s*\(/
    );
  }
);

test(
  'legacy health-only project selection is removed from the orchestrator',
  () => {
    assert.doesNotMatch(
      startAll,
      /appProjectsToStart\(\s*appState\s*\)/
    );

    assert.match(
      startAll,
      /action\s*===\s*['"]start['"]/
    );
  }
);

test(
  'freshness baseline is written for every application launched from current source',
  () => {
    const writeIndex =
      startAll.indexOf(
        'writeApplicationSourceFingerprint'
      );

    const serveIndex =
      startAll.indexOf(
        "'--target=serve'"
      );

    assert.ok(
      writeIndex >= 0,
      'start:all must persist application fingerprints'
    );

    assert.ok(
      serveIndex >= 0,
      'start:all must retain the Nx serve boundary'
    );

    /*
     * At least one runtime write call—not merely the import—
     * must occur before application serve begins.
     */
    const runtimeSection =
      startAll.slice(
        startAll.indexOf(
          'const appState'
        ),
        serveIndex
      );

    assert.match(
      runtimeSection,
      /writeApplicationSourceFingerprint\(\s*root\s*,/
    );
  }
);

test(
  'start:all reports distinct START REUSE and RESTART REQUIRED states',
  () => {
    assert.match(
      startAll,
      /— REUSE/
    );

    assert.match(
      startAll,
      /— START/
    );

    assert.match(
      startAll,
      /— RESTART REQUIRED/
    );
  }
);

test(
  'freshness integration contract participates in startup and script lint gates',
  () => {
    assert.match(
      pkg.scripts[
        'test:startup'
      ],
      /start-all-app-freshness-contract\.test\.cjs/
    );

    assert.match(
      pkg.scripts[
        'test:startup'
      ],
      /start-all-app-freshness-integration-contract\.test\.cjs/
    );

    assert.match(
      pkg.scripts[
        'lint:scripts'
      ],
      /start-all-app-freshness-contract\.test\.cjs/
    );

    assert.match(
      pkg.scripts[
        'lint:scripts'
      ],
      /start-all-app-freshness-integration-contract\.test\.cjs/
    );
  }
);
