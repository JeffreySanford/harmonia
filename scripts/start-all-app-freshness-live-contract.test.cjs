const assert =
  require('node:assert/strict');

const {
  existsSync,
  readFileSync,
} =
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

const qualifierPath =
  path.join(
    root,
    'scripts',
    'qualify-start-all-app-freshness.cjs'
  );

const packagePath =
  path.join(
    root,
    'package.json'
  );

const qualifierExists =
  existsSync(
    qualifierPath
  );

const qualifier =
  qualifierExists
    ? readFileSync(
        qualifierPath,
        'utf8'
      )
    : '';

const pkg =
  JSON.parse(
    readFileSync(
      packagePath,
      'utf8'
    )
  );

test(
  'live start-all application freshness qualifier exists',
  () => {
    assert.equal(
      qualifierExists,
      true,
      'scripts/qualify-start-all-app-freshness.cjs must exist'
    );
  }
);

test(
  'qualifier exercises the real start-all orchestrator',
  () => {
    assert.match(
      qualifier,
      /scripts[\\/]+start-all\.cjs/
    );

    assert.match(
      qualifier,
      /process\.execPath/
    );

    for (
      const flag of
      [
        '--nogpu',
        '--no-worker',
        '--no-tools',
      ]
    ) {
      assert.match(
        qualifier,
        new RegExp(
          flag.replace(
            /-/g,
            '\\-'
          )
        )
      );
    }
  }
);

test(
  'qualifier refuses to commandeer occupied application ports',
  () => {
    assert.match(
      qualifier,
      /3000/
    );

    assert.match(
      qualifier,
      /4200/
    );

    assert.match(
      qualifier,
      /qualification ports?[^]*free/i
    );

    assert.match(
      qualifier,
      /refus/i
    );
  }
);

test(
  'qualifier establishes a current source baseline then proves reuse',
  () => {
    assert.match(
      qualifier,
      /applicationSourceFingerprint/
    );

    assert.match(
      qualifier,
      /writeApplicationSourceFingerprint/
    );

    assert.match(
      qualifier,
      /— REUSE/
    );

    assert.match(
      qualifier,
      /running-current/
    );
  }
);

test(
  'qualifier changes a real backend source input and proves stale detection',
  () => {
    assert.match(
      qualifier,
      /apps[\\/]+backend[\\/]+src[\\/]+main\.ts/
    );

    assert.match(
      qualifier,
      /RESTART REQUIRED/
    );

    assert.match(
      qualifier,
      /source-fingerprint-changed/
    );
  }
);

test(
  'stale rejection must leave the already-running backend alive',
  () => {
    assert.match(
      qualifier,
      /backend[^]*health/i
    );

    assert.match(
      qualifier,
      /still[^]*running|remains[^]*running|survived/i
    );

    assert.match(
      qualifier,
      /RESTART REQUIRED/
    );
  }
);

test(
  'qualifier restores source and freshness evidence in cleanup',
  () => {
    assert.match(
      qualifier,
      /finally/
    );

    assert.match(
      qualifier,
      /restore/i
    );

    assert.match(
      qualifier,
      /backend-source-fingerprint\.txt/
    );

    assert.match(
      qualifier,
      /frontend-source-fingerprint\.txt/
    );
  }
);

test(
  'package exposes and gates the live freshness qualification',
  () => {
    assert.equal(
      pkg.scripts[
        'qualify:start-all-app-freshness'
      ],
      'node scripts/qualify-start-all-app-freshness.cjs'
    );

    assert.match(
      pkg.scripts[
        'test:startup'
      ],
      /start-all-app-freshness-live-contract\.test\.cjs/
    );

    assert.match(
      pkg.scripts[
        'lint:scripts'
      ],
      /start-all-app-freshness-live-contract\.test\.cjs/
    );

    assert.match(
      pkg.scripts[
        'lint:scripts'
      ],
      /qualify-start-all-app-freshness\.cjs/
    );
  }
);
