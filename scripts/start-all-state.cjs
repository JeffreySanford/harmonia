const {
  createHash,
} = require('node:crypto');
const {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} = require('node:fs');
const path = require('node:path');

function workerBuildInputs(root) {
  const fixed = [
    'Dockerfile.worker',
    'requirements.worker.txt',
    'entrypoint.sh',
  ];

  const scriptsDir =
    path.join(root, 'scripts');

  const pythonFiles =
    existsSync(scriptsDir)
      ? readdirSync(scriptsDir)
          .filter(
            (name) =>
              name.endsWith('.py')
          )
          .sort()
          .map(
            (name) =>
              path.join(
                'scripts',
                name
              )
          )
      : [];

  return [
    ...fixed,
    ...pythonFiles,
  ];
}

function workerBuildFingerprint(root) {
  const hash =
    createHash('sha256');

  for (
    const relativePath of
    workerBuildInputs(root)
  ) {
    const absolutePath =
      path.join(
        root,
        relativePath
      );

    if (!existsSync(absolutePath)) {
      throw new Error(
        'Worker build input is missing: ' +
        relativePath
      );
    }

    hash.update(relativePath);
    hash.update('\0');
    hash.update(
      readFileSync(absolutePath)
    );
    hash.update('\0');
  }

  return hash.digest('hex');
}

function fingerprintPath(root) {
  return path.join(
    root,
    'generated',
    'evidence',
    'start-all',
    'worker-build-fingerprint.txt'
  );
}

function readWorkerBuildFingerprint(
  root
) {
  const file =
    fingerprintPath(root);

  if (!existsSync(file)) {
    return null;
  }

  return readFileSync(
    file,
    'utf8'
  ).trim() || null;
}

function writeWorkerBuildFingerprint(
  root,
  fingerprint
) {
  const file =
    fingerprintPath(root);

  mkdirSync(
    path.dirname(file),
    {
      recursive: true,
    }
  );

  writeFileSync(
    file,
    fingerprint + '\n',
    'utf8'
  );
}


const APPLICATION_PROJECTS =
  new Set([
    'backend',
    'frontend',
  ]);

const APPLICATION_SHARED_SOURCE_INPUTS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'nx.json',
  'tsconfig.base.json',
  'tsconfig.json',
];

const APPLICATION_SOURCE_IGNORED_DIRECTORIES =
  new Set([
    'node_modules',
    'dist',
    '.angular',
    'generated',
    'coverage',
    '.nx',
    '.cache',
  ]);

function assertApplicationProject(
  project
) {
  if (
    !APPLICATION_PROJECTS.has(
      project
    )
  ) {
    throw new Error(
      'Unknown Harmonia application project: ' +
      project
    );
  }
}

function normalizeRelativePath(
  relativePath
) {
  return relativePath
    .split(path.sep)
    .join('/');
}

function collectApplicationProjectFiles(
  root,
  directory,
  output
) {
  if (
    !existsSync(
      directory
    )
  ) {
    return;
  }

  const entries =
    readdirSync(
      directory,
      {
        withFileTypes:
          true,
      }
    )
      .sort(
        (
          left,
          right
        ) =>
          left.name.localeCompare(
            right.name
          )
      );

  for (
    const entry of
    entries
  ) {
    if (
      entry.isDirectory() &&
      APPLICATION_SOURCE_IGNORED_DIRECTORIES.has(
        entry.name
      )
    ) {
      continue;
    }

    const absolutePath =
      path.join(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      collectApplicationProjectFiles(
        root,
        absolutePath,
        output
      );

      continue;
    }

    if (
      !entry.isFile()
    ) {
      continue;
    }

    output.push(
      normalizeRelativePath(
        path.relative(
          root,
          absolutePath
        )
      )
    );
  }
}

function applicationSourceInputs(
  root,
  project
) {
  assertApplicationProject(
    project
  );

  const inputs =
    [];

  for (
    const relativePath of
    APPLICATION_SHARED_SOURCE_INPUTS
  ) {
    const absolutePath =
      path.join(
        root,
        relativePath
      );

    if (
      existsSync(
        absolutePath
      )
    ) {
      inputs.push(
        normalizeRelativePath(
          relativePath
        )
      );
    }
  }

  collectApplicationProjectFiles(
    root,
    path.join(
      root,
      'apps',
      project
    ),
    inputs
  );

  return [
    ...new Set(
      inputs
    ),
  ].sort();
}

function applicationSourceFingerprint(
  root,
  project
) {
  assertApplicationProject(
    project
  );

  const hash =
    createHash(
      'sha256'
    );

  hash.update(
    'harmonia-application-source-v1'
  );

  hash.update(
    '\0'
  );

  hash.update(
    project
  );

  hash.update(
    '\0'
  );

  for (
    const relativePath of
    applicationSourceInputs(
      root,
      project
    )
  ) {
    const absolutePath =
      path.join(
        root,
        ...relativePath.split('/')
      );

    hash.update(
      relativePath
    );

    hash.update(
      '\0'
    );

    hash.update(
      readFileSync(
        absolutePath
      )
    );

    hash.update(
      '\0'
    );
  }

  return hash.digest(
    'hex'
  );
}

function applicationFingerprintPath(
  root,
  project
) {
  assertApplicationProject(
    project
  );

  return path.join(
    root,
    'generated',
    'evidence',
    'start-all',
    project +
      '-source-fingerprint.txt'
  );
}

function readApplicationSourceFingerprint(
  root,
  project
) {
  const file =
    applicationFingerprintPath(
      root,
      project
    );

  if (
    !existsSync(
      file
    )
  ) {
    return null;
  }

  return (
    readFileSync(
      file,
      'utf8'
    ).trim() ||
    null
  );
}

function writeApplicationSourceFingerprint(
  root,
  project,
  fingerprint
) {
  const file =
    applicationFingerprintPath(
      root,
      project
    );

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
    String(
      fingerprint
    ) + '\n',
    'utf8'
  );
}

function applicationStartupDecision({
  running,
  currentFingerprint,
  recordedFingerprint,
}) {
  if (
    !running
  ) {
    return {
      action:
        'start',

      reason:
        'not-running',
    };
  }

  if (
    !recordedFingerprint
  ) {
    return {
      action:
        'restart',

      reason:
        'fingerprint-baseline-missing',
    };
  }

  if (
    recordedFingerprint !==
    currentFingerprint
  ) {
    return {
      action:
        'restart',

      reason:
        'source-fingerprint-changed',
    };
  }

  return {
    action:
      'reuse',

    reason:
      'running-current',
  };
}

function capture(
  docker,
  args
) {
  return String(
    docker(args, true) || ''
  ).trim();
}

function workerStartupDecision({
  docker,
  currentFingerprint,
  recordedFingerprint,
}) {
  const imageListing =
    capture(
      docker,
      [
        'image',
        'ls',
        '--quiet',
        'harmonia/worker:dev',
      ]
    );

  if (!imageListing) {
    return {
      clean: false,
      build: true,
      reason: 'worker-image-missing',
    };
  }

  const currentImage =
    capture(
      docker,
      [
        'image',
        'inspect',
        'harmonia/worker:dev',
        '--format',
        '{{.Id}}',
      ]
    );

  if (
    recordedFingerprint !==
    currentFingerprint
  ) {
    return {
      clean: false,
      build: true,
      reason:
        recordedFingerprint
          ? 'worker-build-inputs-changed'
          : 'worker-fingerprint-baseline-missing',
    };
  }

  const rows =
    capture(
      docker,
      [
        'ps',
        '--all',
        '--filter',
        'name=harmonia-worker',
        '--format',
        '{{.Names}}|{{.ID}}',
      ]
    )
      .split(/\r?\n/)
      .filter(Boolean);

  const row =
    rows.find(
      (candidate) =>
        candidate.startsWith(
          'harmonia-worker|'
        )
    );

  if (!row) {
    return {
      clean: false,
      build: false,
      reason:
        'worker-container-missing-current-image',
    };
  }

  const containerId =
    row.split('|')[1];

  const container =
    JSON.parse(
      capture(
        docker,
        [
          'inspect',
          '--format',
          '{{json .}}',
          containerId,
        ]
      )
    );

  if (
    container.Image !==
    currentImage
  ) {
    return {
      clean: false,
      build: false,
      reason:
        'worker-container-image-stale',
    };
  }

  if (!container.State?.Running) {
    return {
      clean: false,
      build: false,
      reason:
        'worker-container-stopped',
    };
  }

  const health =
    container.State
      ?.Health
      ?.Status;

  if (
    health &&
    health !== 'healthy'
  ) {
    return {
      clean: false,
      build: false,
      reason:
        'worker-health-' +
        health,
    };
  }

  return {
    clean: true,
    build: false,
    reason:
      'running-current-healthy',
  };
}

function isHarmoniaBackendHealth(
  body
) {
  return Boolean(
    body &&
    body.ok === true
  );
}

function isHarmoniaFrontendHtml(
  body
) {
  const html =
    String(body || '');

  return (
    /<title>\s*Harmonia\b/i
      .test(html) &&
    /<harmonia-root(?:\s|>)/i
      .test(html)
  );
}

async function probeBackendUrl(
  url,
  fetchImpl
) {
  try {
    const response =
      await fetchImpl(
        url,
        {
          signal:
            AbortSignal.timeout(
              1500
            ),
        }
      );

    if (!response.ok) {
      return false;
    }

    const body =
      await response.json();

    return (
      isHarmoniaBackendHealth(
        body
      )
    );
  } catch {
    return false;
  }
}

async function probeFrontendUrl(
  url,
  fetchImpl
) {
  try {
    const response =
      await fetchImpl(
        url,
        {
          signal:
            AbortSignal.timeout(
              1500
            ),
        }
      );

    if (!response.ok) {
      return false;
    }

    const body =
      await response.text();

    return (
      isHarmoniaFrontendHtml(
        body
      )
    );
  } catch {
    return false;
  }
}

async function anyProbe(
  urls,
  probe
) {
  const results =
    await Promise.all(
      urls.map(probe)
    );

  return results.some(Boolean);
}

async function probeHarmoniaApps(
  fetchImpl = globalThis.fetch
) {
  if (
    typeof fetchImpl !==
    'function'
  ) {
    throw new Error(
      'Application probe requires fetch.'
    );
  }

  const backendUrls = [
    'http://127.0.0.1:3000/api/__health',
    'http://[::1]:3000/api/__health',
    'http://localhost:3000/api/__health',
  ];

  const frontendUrls = [
    'http://127.0.0.1:4200/',
    'http://[::1]:4200/',
    'http://localhost:4200/',
  ];

  const [
    backend,
    frontend,
  ] = await Promise.all([
    anyProbe(
      backendUrls,
      (url) =>
        probeBackendUrl(
          url,
          fetchImpl
        )
    ),
    anyProbe(
      frontendUrls,
      (url) =>
        probeFrontendUrl(
          url,
          fetchImpl
        )
    ),
  ]);

  return {
    backend,
    frontend,
  };
}

function appProjectsToStart(
  state
) {
  const projects = [];

  if (!state.frontend) {
    projects.push('frontend');
  }

  if (!state.backend) {
    projects.push('backend');
  }

  return projects;
}

module.exports = {
  applicationSourceFingerprint,
  applicationSourceInputs,
  applicationStartupDecision,
  appProjectsToStart,
  readApplicationSourceFingerprint,
  isHarmoniaBackendHealth,
  isHarmoniaFrontendHtml,
  probeHarmoniaApps,
  readWorkerBuildFingerprint,
  workerBuildFingerprint,
  workerBuildInputs,
  workerStartupDecision,
  writeApplicationSourceFingerprint,
  writeWorkerBuildFingerprint,
};
