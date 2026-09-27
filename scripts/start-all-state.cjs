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
  appProjectsToStart,
  isHarmoniaBackendHealth,
  isHarmoniaFrontendHtml,
  probeHarmoniaApps,
  readWorkerBuildFingerprint,
  workerBuildFingerprint,
  workerBuildInputs,
  workerStartupDecision,
  writeWorkerBuildFingerprint,
};
