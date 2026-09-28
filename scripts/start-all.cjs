#!/usr/bin/env node
// Compose owns config/image change detection; do not force-recreate healthy services.
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { parseEnv } = require('node:util');
const {
  applicationSourceFingerprint,
  applicationStartupDecision,
  probeHarmoniaApps,
  readApplicationSourceFingerprint,
  readWorkerBuildFingerprint,
  workerBuildFingerprint,
  workerStartupDecision,
  writeApplicationSourceFingerprint,
  writeWorkerBuildFingerprint,
} = require('./start-all-state.cjs');
const {
  seedGeneratedSongs,
} = require('./seed-generated-songs.cjs');

const root = path.resolve(__dirname, '..');

function probeCommand(
  runCommand,
  command,
  args
) {
  try {
    const result = runCommand(
      command,
      args,
      {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    if (
      result?.error ||
      result?.status !== 0
    ) {
      return null;
    }

    const output =
      String(result.stdout || '').trim();

    return output || null;
  } catch {
    return null;
  }
}

function noGpuDetected() {
  return {
    available: false,
    vendor: null,
    name: null,
    memoryMb: null,
  };
}

function detectHostGpu(
  runCommand = spawnSync,
  platform = process.platform
) {
  /*
   * NVIDIA compute-capable detection.
   *
   * Device name and memory are read from the host.
   * No GPU model names are encoded in Harmonia.
   */
  const nvidiaOutput = probeCommand(
    runCommand,
    'nvidia-smi',
    [
      '--query-gpu=name,memory.total',
      '--format=csv,noheader,nounits',
    ]
  );

  if (nvidiaOutput) {
    const line =
      nvidiaOutput.split(/\r?\n/)[0] || '';

    const lastComma =
      line.lastIndexOf(',');

    const name =
      lastComma >= 0
        ? line.slice(0, lastComma).trim()
        : line.trim();

    const memoryValue =
      lastComma >= 0
        ? Number(
            line
              .slice(lastComma + 1)
              .trim()
          )
        : NaN;

    if (name) {
      return {
        available: true,
        vendor: 'nvidia',
        name,
        memoryMb:
          Number.isFinite(memoryValue)
            ? memoryValue
            : null,
      };
    }
  }

  /*
   * Windows vendor/device discovery.
   *
   * CIM supplies the real adapter name. This also detects
   * AMD/Radeon hosts without relying on a particular card.
   */
  if (platform === 'win32') {
    const powershellOutput =
      probeCommand(
        runCommand,
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          [
            '$gpu = Get-CimInstance Win32_VideoController',
            "| Where-Object { $_.Name -match 'NVIDIA|AMD|Radeon' }",
            '| Select-Object -First 1',
            'if ($gpu) {',
            '  [pscustomobject]@{',
            '    Name = $gpu.Name',
            '    AdapterRAM = $gpu.AdapterRAM',
            '  } | ConvertTo-Json -Compress',
            '}',
          ].join(' ')
        ]
      );

    if (powershellOutput) {
      try {
        const parsed =
          JSON.parse(powershellOutput);

        const name =
          String(parsed.Name || '').trim();

        if (name) {
          const vendor =
            /nvidia/i.test(name)
              ? 'nvidia'
              : /amd|radeon/i.test(name)
                ? 'amd'
                : 'unknown';

          const adapterBytes =
            Number(parsed.AdapterRAM);

          return {
            available: true,
            vendor,
            name,
            memoryMb:
              Number.isFinite(adapterBytes) &&
              adapterBytes > 0
                ? Math.round(
                    adapterBytes /
                    (1024 * 1024)
                  )
                : null,
          };
        }
      } catch {
        // Ignore malformed host probe output.
      }
    }
  }

  /*
   * Linux AMD discovery.
   *
   * Prefer ROCm tooling when installed, with PCI discovery
   * as a fallback. The reported name comes from the host.
   */
  if (platform !== 'win32') {
    const rocmOutput =
      probeCommand(
        runCommand,
        'rocm-smi',
        ['--showproductname']
      );

    if (rocmOutput) {
      const line =
        rocmOutput
          .split(/\r?\n/)
          .find(
            (candidate) =>
              /card series|card model|radeon|amd/i.test(
                candidate
              )
          );

      if (line) {
        return {
          available: true,
          vendor: 'amd',
          name: line.trim(),
          memoryMb: null,
        };
      }
    }

    const pciOutput =
      probeCommand(
        runCommand,
        'lspci',
        []
      );

    if (pciOutput) {
      const line =
        pciOutput
          .split(/\r?\n/)
          .find(
            (candidate) =>
              /(?:vga|3d|display).*(?:amd|ati|radeon)/i.test(
                candidate
              )
          );

      if (line) {
        const colon =
          line.indexOf(': ');

        return {
          available: true,
          vendor: 'amd',
          name:
            colon >= 0
              ? line.slice(colon + 2).trim()
              : line.trim(),
          memoryMb: null,
        };
      }
    }
  }

  return noGpuDetected();
}

function resolveGpuEnabled(
  options,
  hardware
) {
  if (options.gpuMode === 'disabled') {
    return false;
  }

  /*
   * The current Harmonia GPU Compose profile uses
   * runtime: nvidia and CUDA provider images.
   *
   * AMD hardware is detected and reported, but it must not
   * accidentally receive the NVIDIA Compose override.
   */
  const runtimeSupported =
    hardware.available &&
    hardware.vendor === 'nvidia';

  if (options.gpuMode === 'required') {
    if (!hardware.available) {
      throw new Error(
        '--gpu was requested, but no supported host GPU was detected.'
      );
    }

    if (!runtimeSupported) {
      throw new Error(
        `GPU detected (${hardware.vendor || 'unknown'}: ${hardware.name || 'unnamed device'}), but the current Harmonia container GPU runtime does not support that vendor.`
      );
    }

    return true;
  }

  return runtimeSupported;
}

function run(command, args, env, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.signal || result.status}). See output above.`);
  return result.stdout || '';
}

function resolvePackageBin(packageName, binName = packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [root],
  });
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const bin =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.[binName];

  if (!bin) {
    throw new Error(
      `Package ${packageName} does not expose a ${binName} executable.`
    );
  }

  return path.resolve(path.dirname(packageJsonPath), bin);
}

function applicationEnvironment(env) {
  for (const key of [
    'MONGO_ROOT_PASSWORD',
    'MONGO_HARMONIA_PASSWORD',
  ]) {
    if (!env[key]?.trim()) {
      throw new Error(
        `Set ${key} in .env before starting. See .env.example.`
      );
    }
  }

  const accessSecret =
    env.JWT_SECRET?.trim();

  const refreshSecret =
    env.JWT_REFRESH_SECRET?.trim();

  if (
    !accessSecret ||
    accessSecret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET must contain at least 32 characters.'
    );
  }

  if (
    !refreshSecret ||
    refreshSecret.length < 32
  ) {
    throw new Error(
      'JWT_REFRESH_SECRET must contain at least 32 characters.'
    );
  }

  if (
    accessSecret === refreshSecret
  ) {
    throw new Error(
      'JWT_SECRET and JWT_REFRESH_SECRET must be different.'
    );
  }
  if (env.PORT && env.PORT !== '3000') {
    throw new Error('start:all requires PORT=3000 to match the frontend API configuration.');
  }
  const nxIsolatePlugins =
    env.NX_ISOLATE_PLUGINS?.trim() ||
    (process.platform === 'win32' ? 'false' : undefined);

  return {
    ...env,
    ...(nxIsolatePlugins ? { NX_ISOLATE_PLUGINS: nxIsolatePlugins } : {}),
    PORT: env.PORT || '3000',
    MONGODB_URI:
      env.MONGODB_URI ||
      `mongodb://harmonia_app:${encodeURIComponent(env.MONGO_HARMONIA_PASSWORD)}@127.0.0.1:27017/harmonia?authSource=harmonia`,
  };
}

function parseOptions(args) {
  if (args.includes('--help')) {
    return {
      help: true,
      worker: true,
      tools: true,
      gpuMode: 'auto',
    };
  }

  const known = new Set([
    '--no-worker',
    '--no-tools',
    '--gpu',
    '--nogpu',
  ]);

  const unknown = args.find(
    (arg) => !known.has(arg)
  );

  if (unknown) {
    throw new Error(
      `Unknown option: ${unknown}. Use --help for usage.`
    );
  }

  if (
    args.includes('--gpu') &&
    args.includes('--nogpu')
  ) {
    throw new Error(
      '--gpu and --nogpu cannot be used together.'
    );
  }

  return {
    help: false,
    worker: !args.includes('--no-worker'),
    tools: !args.includes('--no-tools'),
    gpuMode:
      args.includes('--nogpu')
        ? 'disabled'
        : args.includes('--gpu')
          ? 'required'
          : 'auto',
  };
}

function composeArguments(options) {
  const compose = ['compose', '-f', 'docker-compose.yml'];
  if (options.gpu) compose.push('-f', 'docker-compose.gpu.yml');
  if (options.worker) compose.push('--profile', 'worker');
  if (options.tools) compose.push('--profile', 'tools');
  return compose;
}

function reconcileDocker(docker, compose, { build = true, buildServices = [] } = {}) {
  if (build) {
    // BuildKit provenance contains timestamps, which can change an otherwise cached
    // image's digest. Local dev builds omit it so clean containers keep their IDs.
    docker([...compose, 'build', '--provenance=false', ...buildServices]);
  }

  // Let Compose reconcile image/config changes before attempting health recovery.
  // This is important when an existing container is unhealthy AND its image was
  // just rebuilt: restarting the stale container first would keep it on the old image.
  docker([
    ...compose,
    'up',
    '--detach',
    '--no-build',
  ]);

  // Recover only containers that are still unhealthy after Compose has had the
  // opportunity to recreate changed services.
  const ids = docker([...compose, 'ps', '--all', '--quiet', '--orphans=false'], true)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const id of ids) {
    const state = JSON.parse(
      docker(['inspect', '--format', '{{json .State}}', id], true)
    );
    if (state.Running && state.Health?.Status === 'unhealthy') {
      console.log(`Restarting unhealthy container ${id.slice(0, 12)}...`);
      docker(['restart', id]);
    }
  }

  // Final readiness gate.
  docker([
    ...compose,
    'up',
    '--detach',
    '--no-build',
    '--wait',
    '--wait-timeout',
    '120',
  ]);
}

async function checkPort(port, name, host) {
  const hosts = host ? [host] : ['127.0.0.1', '::1'];

  for (const candidate of hosts) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();

      server.once('error', (error) => {
        if (candidate === '::1' && error?.code === 'EADDRNOTAVAIL') {
          resolve();
          return;
        }

        reject(
          new Error(
            `${name} port ${port} is unavailable on ${candidate}. Stop the conflicting service before starting Harmonia.`
          )
        );
      });

      server.listen(
        { port: Number(port), host: candidate, exclusive: true },
        () => server.close(resolve)
      );
    });
  }
}


async function checkManagedDockerPort(
  port,
  name,
  managedContainer,
  docker,
  probe = checkPort
) {
  try {
    // Docker publishes these services on loopback, so probe the exact
    // address rather than 0.0.0.0. Windows can otherwise allow the wildcard
    // probe even while a native service owns 127.0.0.1:<port>.
    await probe(port, name, '127.0.0.1');
    return;
  } catch {
    const owners = docker(
      ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}'],
      true
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    if (owners.includes(managedContainer)) return;

    const ownerDetails = owners.length
      ? ` Conflicting Docker container(s): ${owners.join(', ')}.`
      : ' The owner appears to be a host process or service.';

    throw new Error(
      `${name} port ${port} is occupied outside Harmonia.${ownerDetails} Stop or remap it before starting Harmonia.`
    );
  }
}

async function checkOllama(env, fetchImpl = globalThis.fetch) {
  if (String(env.USE_OLLAMA || 'false').toLowerCase() !== 'true') return;
  if (typeof fetchImpl !== 'function') throw new Error('Ollama check requires Node.js 20+ with fetch support.');
  const base = new URL(env.OLLAMA_URL || 'http://localhost:11434');
  const url = new URL('/api/tags', base);
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(
      `USE_OLLAMA=true but Ollama is not reachable at ${base.origin}: ${error.message}`
    );
  }
}

async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log(
      [
        'Usage: pnpm start:all [--gpu|--nogpu] [--no-worker] [--no-tools]',
        'Starts MongoDB, optional Mongo Express, optional utility worker, backend, and frontend.',
        'GPU mode defaults to automatic host GPU detection.',
        '--gpu explicitly requires a supported GPU runtime and fails if none is available.',
        '--nogpu forces CPU mode even when a supported GPU is present.',
        '--no-worker omits the utility worker.',
        '--no-tools omits Mongo Express.',
        'Docker must already be running.',
      ].join('\n')
    );
    return;
  }

  /*
   * Detect GPU before Docker reconciliation and before application
   * port checks. Default startup automatically uses a supported
   * NVIDIA GPU when one is present.
   */
  const hardware = detectHostGpu();
  const gpuEnabled =
    resolveGpuEnabled(options, hardware);

  if (hardware.available) {
    console.log(
      [
        'Host GPU detected:',
        `vendor=${hardware.vendor || 'unknown'}`,
        `device=${hardware.name || 'unknown'}`,
        hardware.memoryMb
          ? `memory=${hardware.memoryMb} MiB`
          : null,
      ]
        .filter(Boolean)
        .join(' ')
    );
  } else {
    console.log(
      'Host GPU detected: none.'
    );
  }

  if (options.gpuMode === 'disabled') {
    console.log(
      'GPU mode: disabled by --nogpu.'
    );
  } else if (options.gpuMode === 'required') {
    console.log(
      'GPU mode: enabled by --gpu.'
    );
  } else if (gpuEnabled) {
    console.log(
      'GPU mode: enabled automatically.'
    );
  } else if (hardware.available) {
    console.log(
      `GPU mode: ${hardware.vendor || 'unknown'} hardware detected but no compatible Harmonia container runtime is configured; using CPU mode.`
    );
  } else {
    console.log(
      'GPU mode: CPU fallback.'
    );
  }

  const envFile = path.join(root, '.env');
  const env = applicationEnvironment({
    ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}),
    ...process.env,
    HARMONIA_GPU_ENABLED:
      gpuEnabled ? 'true' : 'false',
  });
  const nx = resolvePackageBin('nx', 'nx');
  if (!existsSync(nx)) throw new Error('Dependencies are missing. Run pnpm install first.');

  const docker = (dockerArgs, capture) => run('docker', dockerArgs, env, capture);
  docker(['info', '--format', '{{.ServerVersion}}'], true);
  docker(['compose', 'version'], true);

  // Fail before an expensive ML reconciliation if a host service or unrelated
  // container already owns Harmonia's published database/tooling ports.
  await checkManagedDockerPort(
    27017,
    'MongoDB',
    'harmonia-mongo-i9',
    docker
  );
  if (options.tools) {
    await checkManagedDockerPort(
      8081,
      'Mongo Express',
      'harmonia-mongo-ui',
      docker
    );
  }

  const compose = composeArguments({
    ...options,
    gpu: gpuEnabled,
  });
  docker([...compose, 'config', '--quiet']);

  let workerDecision = {
    clean: true,
    build: false,
    reason: 'worker-profile-disabled',
  };

  let workerFingerprint = null;

  if (options.worker) {
    workerFingerprint =
      workerBuildFingerprint(root);

    const recordedFingerprint =
      readWorkerBuildFingerprint(root);

    workerDecision =
      workerStartupDecision({
        docker,
        currentFingerprint:
          workerFingerprint,
        recordedFingerprint,
      });

    console.log(
      'Docker worker: ' +
      (workerDecision.clean
        ? 'clean'
        : 'dirty') +
      ' (' +
      workerDecision.reason +
      ')' +
      (workerDecision.build
        ? ' — rebuilding worker image'
        : ' — build skipped')
    );
  }

  console.log(
    'Reconciling Docker services...'
  );

  reconcileDocker(
    docker,
    compose,
    {
      build:
        options.worker &&
        workerDecision.build,
      buildServices:
        options.worker
          ? ['worker']
          : [],
    }
  );

  if (
    options.worker &&
    workerDecision.build &&
    workerFingerprint
  ) {
    writeWorkerBuildFingerprint(
      root,
      workerFingerprint
    );
  }

  // Test the actual application credentials, not only the container's root healthcheck.
  const mongoose = require('mongoose');
  const connection = mongoose.createConnection(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    await connection.db.admin().ping();
  } catch {
    throw new Error(
      'MongoDB application connection failed. Check MONGODB_URI and existing database credentials; changing .env does not update users in an existing volume.'
    );
  } finally {
    await connection.close();
  }

  await seedGeneratedSongs({
    root,
    env,
    mongoUri:
      env.MONGODB_URI,
  });

  await checkOllama(env);

  const appState =
    await probeHarmoniaApps();

  const backendFingerprint =
    applicationSourceFingerprint(
      root,
      'backend'
    );

  const frontendFingerprint =
    applicationSourceFingerprint(
      root,
      'frontend'
    );

  const backendDecision =
    applicationStartupDecision({
      running:
        appState.backend,

      currentFingerprint:
        backendFingerprint,

      recordedFingerprint:
        readApplicationSourceFingerprint(
          root,
          'backend'
        ),
    });

  const frontendDecision =
    applicationStartupDecision({
      running:
        appState.frontend,

      currentFingerprint:
        frontendFingerprint,

      recordedFingerprint:
        readApplicationSourceFingerprint(
          root,
          'frontend'
        ),
    });

  const applicationPlans = [
    {
      project:
        'frontend',

      name:
        'Frontend',

      port:
        4200,

      fingerprint:
        frontendFingerprint,

      decision:
        frontendDecision,
    },
    {
      project:
        'backend',

      name:
        'Backend',

      port:
        Number(
          env.PORT
        ),

      fingerprint:
        backendFingerprint,

      decision:
        backendDecision,
    },
  ];

  for (
    const plan of
    applicationPlans
  ) {
    if (
      plan.decision.action ===
        'reuse'
    ) {
      console.log(
        plan.name +
        ': existing Harmonia instance detected — REUSE (' +
        plan.decision.reason +
        ')'
      );

      continue;
    }

    if (
      plan.decision.action ===
        'start'
    ) {
      await checkPort(
        plan.port,
        plan.name
      );

      console.log(
        plan.name +
        ': not running — START (' +
        plan.decision.reason +
        ')'
      );

      continue;
    }

    if (
      plan.decision.action ===
        'restart'
    ) {
      console.error(
        plan.name +
        ': existing Harmonia instance is stale — RESTART REQUIRED (' +
        plan.decision.reason +
        ')'
      );
    }
  }

  const restartRequired =
    applicationPlans.filter(
      (plan) =>
        plan.decision.action ===
        'restart'
    );

  if (
    restartRequired.length > 0
  ) {
    const names =
      restartRequired
        .map(
          (plan) =>
            plan.name
        )
        .join(', ');

    throw new Error(
      'RESTART REQUIRED: stop the stale Harmonia server(s) (' +
      names +
      ') and rerun pnpm start:all. ' +
      'start:all will not terminate host processes automatically.'
    );
  }

  const projects =
    applicationPlans
      .filter(
        (plan) =>
          plan.decision.action ===
          'start'
      )
      .map(
        (plan) =>
          plan.project
      );

  if (
    projects.length === 0
  ) {
    console.log(
      'Harmonia already running with current application source fingerprints. ' +
      'Docker services reconciled and application servers reused.'
    );

    return;
  }

  /*
   * Record the exact source snapshot that the Nx serve processes
   * below are about to execute.
   *
   * A failed launch is still safe: the next run sees the app as
   * not running and START wins regardless of the stored baseline.
   */
  for (
    const plan of
    applicationPlans
  ) {
    if (
      plan.decision.action !==
        'start'
    ) {
      continue;
    }

    writeApplicationSourceFingerprint(
      root,
      plan.project,
      plan.fingerprint
    );
  }

  console.log(
    'Database ready. Starting current application server(s): ' +
    projects.join(', ') +
    '. Ctrl+C stops only the server(s) started by this command.'
  );

  run(
    process.execPath,
    [
      nx,
      'run-many',
      '--target=serve',
      '--projects=' +
        projects.join(','),
      '--parallel=2',
    ],
    env
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  applicationEnvironment,
  checkManagedDockerPort,
  checkOllama,
  checkPort,
  composeArguments,
  detectHostGpu,
  main,
  parseOptions,
  reconcileDocker,
  resolveGpuEnabled,
  resolvePackageBin,
  run,
};
