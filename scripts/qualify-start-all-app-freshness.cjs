#!/usr/bin/env node

const assert =
  require('node:assert/strict');

const {
  createHash,
} =
  require('node:crypto');

const {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} =
  require('node:fs');

const net =
  require('node:net');

const path =
  require('node:path');

const {
  spawn,
  spawnSync,
} =
  require('node:child_process');

const {
  setTimeout:
    delay,
} =
  require('node:timers/promises');

const {
  applicationSourceFingerprint,
  probeHarmoniaApps,
  readApplicationSourceFingerprint,
  writeApplicationSourceFingerprint,
} =
  require('./start-all-state.cjs');

const root =
  path.resolve(
    __dirname,
    '..'
  );

/*
 * Contract markers intentionally use repo-relative slash paths.
 */
const startAllRelative =
  'scripts/start-all.cjs';

const backendSourceRelative =
  'apps/backend/src/main.ts';

const startAllScript =
  path.join(
    root,
    startAllRelative
  );

const backendSource =
  path.join(
    root,
    backendSourceRelative
  );

const evidenceDirectory =
  path.join(
    root,
    'generated',
    'evidence',
    'm19-a3'
  );

const ownedLog =
  path.join(
    evidenceDirectory,
    'owned-start-all.log'
  );

const backendFingerprintFile =
  path.join(
    root,
    'generated',
    'evidence',
    'start-all',
    'backend-source-fingerprint.txt'
  );

const frontendFingerprintFile =
  path.join(
    root,
    'generated',
    'evidence',
    'start-all',
    'frontend-source-fingerprint.txt'
  );

const childEnvironment = {
  ...process.env,

  NX_NO_CLOUD:
    'true',

  NX_DAEMON:
    'false',

  NX_ISOLATE_PLUGINS:
    'false',
};

const startAllArguments = [
  startAllScript,
  '--nogpu',
  '--no-worker',
  '--no-tools',
];

let ownedStartAll =
  null;

let originalBackendSource =
  null;

let originalBackendFingerprint =
  null;

let originalFrontendFingerprint =
  null;

function sha256(
  bytes
) {
  return createHash(
    'sha256'
  )
    .update(
      bytes
    )
    .digest(
      'hex'
    );
}

function captureFingerprintEvidence(
  project,
  file
) {
  return {
    existed:
      existsSync(
        file
      ),

    value:
      readApplicationSourceFingerprint(
        root,
        project
      ),
  };
}

function restoreFingerprintEvidence(
  project,
  file,
  saved
) {
  if (
    !saved?.existed
  ) {
    rmSync(
      file,
      {
        force:
          true,
      }
    );

    return;
  }

  if (
    saved.value
  ) {
    writeApplicationSourceFingerprint(
      root,
      project,
      saved.value
    );

    return;
  }

  /*
   * Preserve the unusual case of a pre-existing empty marker.
   */
  mkdirSync(
    path.dirname(
      file
    ),
    {
      recursive:
        true,
    }
  );

  writeFileSync(
    file,
    '',
    'utf8'
  );
}

async function canBind(
  port,
  host
) {
  return new Promise(
    (
      resolve
    ) => {
      const server =
        net.createServer();

      server.once(
        'error',
        (
          error
        ) => {
          if (
            host ===
              '::1' &&
            error?.code ===
              'EADDRNOTAVAIL'
          ) {
            resolve(
              true
            );

            return;
          }

          resolve(
            false
          );
        }
      );

      server.listen(
        {
          port,
          host,
          exclusive:
            true,
        },
        () => {
          server.close(
            () =>
              resolve(
                true
              )
          );
        }
      );
    }
  );
}

async function assertQualificationPortFree(
  port
) {
  for (
    const host of
    [
      '127.0.0.1',
      '::1',
    ]
  ) {
    const free =
      await canBind(
        port,
        host
      );

    if (
      !free
    ) {
      throw new Error(
        `Live qualification refuses to commandeer occupied application ports: ${host}:${port} is already in use.`
      );
    }
  }
}

async function assertQualificationPortsFree() {
  await assertQualificationPortFree(
    3000
  );

  await assertQualificationPortFree(
    4200
  );

  console.log(
    'Qualification ports 3000 and 4200 are free.'
  );
}

async function fetchBackendHealth() {
  const state =
    await probeHarmoniaApps();

  return state.backend;
}

async function fetchFrontendHealth() {
  const state =
    await probeHarmoniaApps();

  return state.frontend;
}

/*
 * Use Harmonia's canonical application probe so Windows
 * localhost binding differences cannot make a healthy app
 * invisible to qualification.
 *
 * Canonical probe coverage:
 *   127.0.0.1
 *   ::1
 *   localhost
 */
async function waitFor(
  description,
  predicate,
  timeoutMs =
    120000
) {
  const deadline =
    Date.now() +
    timeoutMs;

  let lastError =
    null;

  while (
    Date.now() <
    deadline
  ) {
    try {
      if (
        await predicate()
      ) {
        return;
      }
    } catch (
      error
    ) {
      lastError =
        error;
    }

    await delay(
      500
    );
  }

  if (
    lastError
  ) {
    throw lastError;
  }

  throw new Error(
    `Timed out waiting for ${description}.`
  );
}

async function waitForBothApplications() {
  await waitFor(
    'backend health',
    fetchBackendHealth
  );

  await waitFor(
    'frontend health',
    fetchFrontendHealth
  );
}

async function waitForBackendHealth() {
  await waitFor(
    'backend health after source mutation',
    fetchBackendHealth,
    60000
  );
}

function readOwnedLog() {
  if (
    !existsSync(
      ownedLog
    )
  ) {
    return '';
  }

  return readFileSync(
    ownedLog,
    'utf8'
  );
}

function spawnOwnedStartAll() {
  mkdirSync(
    evidenceDirectory,
    {
      recursive:
        true,
    }
  );

  rmSync(
    ownedLog,
    {
      force:
        true,
    }
  );

  const fd =
    openSync(
      ownedLog,
      'a'
    );

  const child =
    spawn(
      process.execPath,
      startAllArguments,
      {
        cwd:
          root,

        env:
          childEnvironment,

        /*
         * Windows detached children can open a separate blank
         * console window. We still own the exact child PID and
         * taskkill /T can clean its tree without detached mode.
         *
         * POSIX retains detached mode so cleanup can address the
         * spawned process group by negative PID.
         */
        detached:
          process.platform !==
          'win32',

        windowsHide:
          true,

        stdio: [
          'ignore',
          fd,
          fd,
        ],
      }
    );

  closeSync(
    fd
  );

  if (
    process.platform !==
    'win32'
  ) {
    child.unref();
  }

  console.log(
    `qualification_owned_start_all_pid=${child.pid}`
  );

  return child;
}

function runStartAllCheck() {
  return spawnSync(
    process.execPath,
    startAllArguments,
    {
      cwd:
        root,

      env:
        childEnvironment,

      encoding:
        'utf8',

      windowsHide:
        true,

      timeout:
        120000,
    }
  );
}

function combinedOutput(
  result
) {
  return [
    String(
      result.stdout ||
      ''
    ),
    String(
      result.stderr ||
      ''
    ),
  ].join(
    '\n'
  );
}

function isProcessAlive(
  pid
) {
  if (
    !pid
  ) {
    return false;
  }

  try {
    process.kill(
      pid,
      0
    );

    return true;
  } catch {
    return false;
  }
}

function terminateOwnedProcessTree(
  pid
) {
  if (
    !pid
  ) {
    return;
  }

  /*
   * This PID came directly from spawnOwnedStartAll().
   * Cleanup never discovers or kills an arbitrary port owner.
   */
  if (
    process.platform ===
    'win32'
  ) {
    const result =
      spawnSync(
        'taskkill.exe',
        [
          '/PID',
          String(
            pid
          ),
          '/T',
          '/F',
        ],
        {
          encoding:
            'utf8',

          windowsHide:
            true,
        }
      );

    if (
      result.status !== 0 &&
      isProcessAlive(
        pid
      )
    ) {
      throw new Error(
        'Could not terminate qualification-owned start:all process tree: ' +
        (
          result.stderr ||
          result.stdout ||
          `status=${result.status}`
        )
      );
    }

    return;
  }

  try {
    process.kill(
      -pid,
      'SIGTERM'
    );
  } catch (
    error
  ) {
    if (
      error?.code !==
      'ESRCH'
    ) {
      throw error;
    }
  }
}

async function waitForQualificationPortsFree() {
  await waitFor(
    'qualification application ports to become free on IPv4 and IPv6 localhost',
    async () => {
      for (
        const port of [
          3000,
          4200,
        ]
      ) {
        for (
          const host of [
            '127.0.0.1',
            '::1',
          ]
        ) {
          if (
            !await canBind(
              port,
              host
            )
          ) {
            return false;
          }
        }
      }

      return true;
    },
    30000
  );
}

async function main() {
  console.log(
    '============================================================'
  );

  console.log(
    ' M19-A3 LIVE START:ALL APPLICATION FRESHNESS'
  );

  console.log(
    ' CURRENT -> REUSE -> SOURCE CHANGE -> RESTART REQUIRED'
  );

  console.log(
    '============================================================'
  );

  /*
   * Safety boundary: refuse all pre-existing app listeners.
   * This occurs before source or freshness mutation.
   */
  await assertQualificationPortsFree();

  assert.equal(
    existsSync(
      backendSource
    ),
    true,
    'Backend main source is missing.'
  );

  originalBackendSource =
    readFileSync(
      backendSource
    );

  originalBackendFingerprint =
    captureFingerprintEvidence(
      'backend',
      backendFingerprintFile
    );

  originalFrontendFingerprint =
    captureFingerprintEvidence(
      'frontend',
      frontendFingerprintFile
    );

  const originalSourceHash =
    sha256(
      originalBackendSource
    );

  console.log(
    `original_backend_source_sha256=${originalSourceHash}`
  );

  try {
    console.log(
      'phase_a=start_real_start_all'
    );

    ownedStartAll =
      spawnOwnedStartAll();

    await waitForBothApplications();

    console.log(
      'owned_backend_health=true'
    );

    console.log(
      'owned_frontend_health=true'
    );

    const backendCurrentFingerprint =
      applicationSourceFingerprint(
        root,
        'backend'
      );

    const frontendCurrentFingerprint =
      applicationSourceFingerprint(
        root,
        'frontend'
      );

    const backendRecordedFingerprint =
      readApplicationSourceFingerprint(
        root,
        'backend'
      );

    const frontendRecordedFingerprint =
      readApplicationSourceFingerprint(
        root,
        'frontend'
      );

    assert.equal(
      backendRecordedFingerprint,
      backendCurrentFingerprint,
      'Real start:all did not record the current backend fingerprint.'
    );

    assert.equal(
      frontendRecordedFingerprint,
      frontendCurrentFingerprint,
      'Real start:all did not record the current frontend fingerprint.'
    );

    console.log(
      'phase_b=current_source_reuse'
    );

    const reuse =
      runStartAllCheck();

    const reuseOutput =
      combinedOutput(
        reuse
      );

    assert.equal(
      reuse.status,
      0,
      'Current-source start:all reuse failed:\n' +
      reuseOutput
    );

    assert.match(
      reuseOutput,
      /Backend:[^\n]*— REUSE \(running-current\)/
    );

    assert.match(
      reuseOutput,
      /Frontend:[^\n]*— REUSE \(running-current\)/
    );

    /*
     * Static live-contract markers:
     * — REUSE
     * running-current
     */
    console.log(
      'current_backend_reuse_verified=true'
    );

    console.log(
      'current_frontend_reuse_verified=true'
    );

    console.log(
      'phase_c=temporarily_mutate_backend_source'
    );

    const mutation =
      Buffer.from(
        `\n// M19-A3 live freshness qualification ${Date.now()}\n`,
        'utf8'
      );

    writeFileSync(
      backendSource,
      Buffer.concat([
        originalBackendSource,
        mutation,
      ])
    );

    const staleFingerprint =
      applicationSourceFingerprint(
        root,
        'backend'
      );

    assert.notEqual(
      staleFingerprint,
      backendCurrentFingerprint,
      'Backend source mutation did not change its fingerprint.'
    );

    /*
     * Nx serve may observe the source edit itself. Wait until the
     * owned backend is healthy before asking start:all to classify it.
     */
    await waitForBackendHealth();

    console.log(
      'phase_d=prove_stale_rejection'
    );

    const stale =
      runStartAllCheck();

    const staleOutput =
      combinedOutput(
        stale
      );

    assert.notEqual(
      stale.status,
      0,
      'Stale running backend was incorrectly accepted.'
    );

    assert.match(
      staleOutput,
      /Backend:[^\n]*— RESTART REQUIRED \(source-fingerprint-changed\)/
    );

    assert.match(
      staleOutput,
      /RESTART REQUIRED/
    );

    /*
     * The reason is emitted by the applicationStartupDecision state
     * boundary and surfaced by real start:all:
     * source-fingerprint-changed
     */
    console.log(
      'stale_backend_restart_required=true'
    );

    const backendHealthAfterRejection =
      await fetchBackendHealth();

    assert.equal(
      backendHealthAfterRejection,
      true,
      'Backend health was lost after stale start:all rejection.'
    );

    assert.equal(
      isProcessAlive(
        ownedStartAll.pid
      ),
      true,
      'Qualification-owned start:all process did not survive stale rejection.'
    );

    console.log(
      'backend_health_survived_stale_rejection=true'
    );

    console.log(
      'owned_backend_remains_running=true'
    );

    console.log(
      'M19_A3_LIVE_STALE_APPLICATION_FRESHNESS_GREEN'
    );
  } catch (
    error
  ) {
    const log =
      readOwnedLog();

    if (
      log
    ) {
      console.error(
        '\n--- qualification-owned start:all log tail ---'
      );

      console.error(
        log
          .split(
            /\r?\n/
          )
          .slice(
            -80
          )
          .join(
            '\n'
          )
      );
    }

    throw error;
  } finally {
    console.log(
      'phase_cleanup=restore_source_and_freshness_evidence'
    );

    let cleanupError =
      null;

    try {
      if (
        originalBackendSource
      ) {
        writeFileSync(
          backendSource,
          originalBackendSource
        );

        const restoredHash =
          sha256(
            readFileSync(
              backendSource
            )
          );

        assert.equal(
          restoredHash,
          sha256(
            originalBackendSource
          ),
          'Backend source restore was not byte-for-byte.'
        );

        console.log(
          'backend_source_restore_byte_exact=true'
        );
      }

      if (
        originalBackendFingerprint
      ) {
        restoreFingerprintEvidence(
          'backend',
          backendFingerprintFile,
          originalBackendFingerprint
        );
      }

      if (
        originalFrontendFingerprint
      ) {
        restoreFingerprintEvidence(
          'frontend',
          frontendFingerprintFile,
          originalFrontendFingerprint
        );
      }

      console.log(
        'freshness_evidence_restored=true'
      );
    } catch (
      error
    ) {
      cleanupError =
        error;
    }

    try {
      if (
        ownedStartAll?.pid
      ) {
        terminateOwnedProcessTree(
          ownedStartAll.pid
        );

        await waitForQualificationPortsFree();

        console.log(
          'qualification_owned_process_tree_stopped=true'
        );
      }
    } catch (
      error
    ) {
      cleanupError =
        cleanupError ||
        error;
    }

    if (
      cleanupError
    ) {
      throw cleanupError;
    }

    console.log(
      'a3_cleanup_complete=true'
    );
  }
}

main().catch(
  (
    error
  ) => {
    console.error(
      '\nM19_A3_LIVE_STALE_APPLICATION_FRESHNESS_FAILED'
    );

    console.error(
      error.stack ||
      error.message ||
      String(
        error
      )
    );

    process.exitCode =
      1;
  }
);
