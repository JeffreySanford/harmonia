const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createInitialization,
  createPlan,
  createVerification,
  huggingFaceDownloadReposForArtifact,
  isSafeArchiveMemberPath,
  normalizePinnedHuggingFaceMainRef,
  inspectShallowPathPresence,
  verifyRequiredFile,
  loadRegistry,
  safeResolveUnderRoot,
  wildcardToRegExp,
} = require('./model-manager.cjs');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'harmonia-model-plan-'));
}

function ensureFile(filePath, content = 'fixture') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createHuggingFaceFixture(root, artifact) {
  const repoCache =
    'models--' + artifact.source.repoId.replace(/\//g, '--');
  const revision =
    artifact.source.revision ||
    ('fixture-' + artifact.artifactId.replace(/[^a-z0-9]/gi, ''));

  const base = path.join(
    root,
    artifact.destination,
    'hub',
    repoCache
  );

  ensureFile(path.join(base, 'refs', 'main'), revision + '\n');

  for (const required of artifact.verification.requiredFiles || []) {
    ensureFile(path.join(base, 'snapshots', revision, required));
  }
}


function createHuggingFaceRepoFixture(root, destination, repoId) {
  const repoCache =
    'models--' + repoId.replace(/\//g, '--');
  const revision =
    'fixture-' + repoId.replace(/[^a-z0-9]/gi, '');
  const base = path.join(
    root,
    destination,
    'hub',
    repoCache
  );

  ensureFile(path.join(base, 'refs', 'main'), revision + '\n');
  ensureFile(
    path.join(base, 'snapshots', revision, 'fixture.bin'),
    'dependency-fixture'
  );
}

function createMusicGenDependencyFixtures(root, artifact) {
  for (const repoId of huggingFaceDownloadReposForArtifact(artifact).slice(1)) {
    createHuggingFaceRepoFixture(
      root,
      artifact.destination,
      repoId
    );
  }
}

function createCheckpointFixture(root, artifact) {
  const base = path.join(root, artifact.destination);

  for (const required of artifact.verification.requiredFiles || []) {
    ensureFile(path.join(base, required));
  }

  for (const pattern of artifact.verification.checkpointGlobs || []) {
    const filename = pattern.replace('*', '160000');
    ensureFile(path.join(base, filename));
  }
}

function createDefaultInstallFixture(root) {
  const registry = loadRegistry();

  for (const artifact of registry.artifacts) {
    if (!artifact.defaultInstall) {
      continue;
    }

    if (artifact.source.kind === 'huggingface') {
      createHuggingFaceFixture(root, artifact);
    } else {
      createCheckpointFixture(root, artifact);
    }
  }
}

test('models:plan reports a complete default cache without mutation actions', () => {
  const root = tempRoot();
  createDefaultInstallFixture(root);

  const result = createPlan({
    root,
    modelIds: [],
    providerIds: [],
    artifactIds: [],
    auth: { huggingFace: false },
  });

  assert.equal(result.command, 'plan');
  assert.equal(result.summary.selectedModels, 6);
  assert.equal(result.summary.selectedArtifacts, 8);
  assert.equal(result.summary.verified, 6);
  assert.equal(result.summary.missing, 2);
  assert.equal(result.summary.downloadsRequired, 0);
  assert.equal(result.summary.authenticationRequired, 0);
  assert.equal(result.summary.defaultSkipped, 2);

  const stable = result.artifacts.find(
    (row) => row.artifactId === 'stable-audio-3-small-music'
  );
  assert.equal(stable.state, 'verified');
  assert.equal(stable.action, 'none');
  assert.equal(stable.authentication, 'missing');

  const medium = result.artifacts.find(
    (row) => row.artifactId === 'musicgen-medium'
  );
  assert.equal(medium.state, 'missing');
  assert.equal(medium.action, 'skipped-default');
});

test('models:plan identifies missing default artifacts and gated authentication', () => {
  const root = tempRoot();

  const result = createPlan({
    root,
    modelIds: [],
    providerIds: [],
    artifactIds: [],
    auth: { huggingFace: false },
  });

  assert.equal(result.summary.missing, 8);
  assert.equal(result.summary.downloadsRequired, 5);
  assert.equal(result.summary.authenticationRequired, 1);
  assert.equal(result.summary.defaultSkipped, 2);

  const stable = result.artifacts.find(
    (row) => row.artifactId === 'stable-audio-3-small-music'
  );
  assert.equal(stable.action, 'authenticate');
});

test('explicit model selection overrides defaultInstall for optional MusicGen Medium', () => {
  const root = tempRoot();

  const result = createPlan({
    root,
    modelIds: ['musicgen-medium'],
    providerIds: [],
    artifactIds: [],
  });

  assert.equal(result.summary.selectedModels, 1);
  assert.equal(result.summary.selectedArtifacts, 1);
  assert.equal(result.artifacts[0].artifactId, 'musicgen-medium');
  assert.equal(result.artifacts[0].state, 'missing');
  assert.equal(result.artifacts[0].action, 'download');
});

test('provider selection resolves DiffSinger composite artifacts', () => {
  const root = tempRoot();
  const registry = loadRegistry();

  for (const artifact of registry.artifacts.filter(
    (candidate) => candidate.providerId === 'diffsinger'
  )) {
    createCheckpointFixture(root, artifact);
  }

  const result = createPlan({
    root,
    modelIds: [],
    providerIds: ['diffsinger'],
    artifactIds: [],
  });

  assert.equal(result.summary.selectedModels, 1);
  assert.equal(result.summary.selectedArtifacts, 3);
  assert.equal(result.summary.verified, 3);
  assert.equal(result.models[0].modelId, 'diffsinger-acoustic-hifigan');
  assert.equal(result.models[0].state, 'verified');
  assert.deepEqual(
    result.artifacts.map((row) => row.action),
    ['none', 'none', 'none']
  );
});

test('explicit gated artifact selection reports authentication before download', () => {
  const root = tempRoot();

  const result = createPlan({
    root,
    modelIds: [],
    providerIds: [],
    artifactIds: ['stable-audio-3-small-music'],
    auth: { huggingFace: false },
  });

  assert.equal(result.summary.selectedModels, 1);
  assert.equal(result.summary.selectedArtifacts, 1);
  assert.equal(result.artifacts[0].state, 'missing');
  assert.equal(result.artifacts[0].authentication, 'missing');
  assert.equal(result.artifacts[0].action, 'authenticate');
});

test('invalid selectors fail before inspection', () => {
  const root = tempRoot();

  assert.throws(
    () =>
      createPlan({
        root,
        modelIds: ['does-not-exist'],
        providerIds: [],
        artifactIds: [],
      }),
    /Unknown model selector/
  );

  assert.throws(
    () =>
      createPlan({
        root,
        modelIds: [],
        providerIds: ['does-not-exist'],
        artifactIds: [],
      }),
    /Unknown provider selector/
  );
});

test('model root resolution prevents artifact escape', () => {
  const root = tempRoot();

  assert.throws(
    () => safeResolveUnderRoot(root, '../outside'),
    /escapes model root/
  );

  assert.equal(
    safeResolveUnderRoot(root, 'musicgen/huggingface'),
    path.join(root, 'musicgen', 'huggingface')
  );
});


test('Windows shallow HF inspection accepts EACCES-visible cache entries', () => {
  const blocked = Object.assign(new Error('permission denied'), {
    code: 'EACCES',
  });
  const fakeFs = {
    existsSync: () => false,
    lstatSync: () => {
      throw blocked;
    },
    readdirSync: () => ['model_config.json'],
  };

  assert.deepEqual(
    inspectShallowPathPresence(
      path.join('cache', 'model_config.json'),
      fakeFs,
      'win32'
    ),
    {
      present: true,
      mode: 'directory-entry',
    }
  );

  assert.deepEqual(
    inspectShallowPathPresence(
      path.join('cache', 'missing.json'),
      fakeFs,
      'win32'
    ),
    {
      present: false,
      mode: 'missing',
    }
  );
});

test('shallow HF inspection does not hide normal missing files', () => {
  const missing = Object.assign(new Error('not found'), {
    code: 'ENOENT',
  });
  const fakeFs = {
    existsSync: () => false,
    lstatSync: () => {
      throw missing;
    },
    readdirSync: () => ['model_config.json'],
  };

  assert.deepEqual(
    inspectShallowPathPresence(
      path.join('cache', 'model_config.json'),
      fakeFs,
      'win32'
    ),
    {
      present: false,
      mode: 'missing',
    }
  );

  assert.deepEqual(
    inspectShallowPathPresence(
      path.join('cache', 'model_config.json'),
      fakeFs,
      'linux'
    ),
    {
      present: false,
      mode: 'missing',
    }
  );
});

test('MusicGen registry uses AudioCraft checkpoint markers', () => {
  const registry = loadRegistry();

  for (const artifactId of [
    'musicgen-small',
    'musicgen-stereo-small',
    'musicgen-medium',
    'musicgen-stereo-medium',
  ]) {
    const artifact = registry.artifacts.find(
      (candidate) => candidate.artifactId === artifactId
    );

    assert.ok(artifact, `missing registry artifact ${artifactId}`);
    assert.deepEqual(artifact.verification.requiredFiles, [
      'state_dict.bin',
      'compression_state_dict.bin',
    ]);
  }
});



test('Stable Audio registry verifies weights and bundled text encoder assets', () => {
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'stable-audio-3-small-music'
  );

  assert.ok(artifact);
  assert.deepEqual(artifact.verification.requiredFiles, [
    'model_config.json',
    'model.safetensors',
    't5gemma-b-b-ul2/config.json',
    't5gemma-b-b-ul2/model.safetensors',
    't5gemma-b-b-ul2/tokenizer_config.json',
  ]);
});

test('models:verify deeply verifies the complete default fixture cache', () => {
  const root = tempRoot();
  createDefaultInstallFixture(root);

  const result = createVerification({
    root,
    modelIds: [],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
  });

  assert.equal(result.command, 'verify');
  assert.equal(result.ok, true);
  assert.equal(result.summary.selectedModels, 6);
  assert.equal(result.summary.selectedArtifacts, 8);
  assert.equal(result.summary.verified, 6);
  assert.equal(result.summary.missing, 2);
  assert.equal(result.summary.corrupt, 0);
  assert.equal(result.summary.unavailable, 0);
  assert.equal(result.summary.optionalSkipped, 2);
});

test('models:verify rejects a zero-byte required Hugging Face file', () => {
  const root = tempRoot();
  createDefaultInstallFixture(root);
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'musicgen-small'
  );
  const repoCache =
    'models--' + artifact.source.repoId.replace(/\//g, '--');
  const revision =
    'fixture-' + artifact.artifactId.replace(/[^a-z0-9]/gi, '');
  const filePath = path.join(
    root,
    artifact.destination,
    'hub',
    repoCache,
    'snapshots',
    revision,
    'state_dict.bin'
  );

  fs.writeFileSync(filePath, '');

  const result = createVerification({
    root,
    modelIds: ['musicgen-small'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.corrupt, 1);
  assert.equal(result.artifacts[0].state, 'corrupt');
  assert.match(result.artifacts[0].detail, /zero bytes/);
});

test('models:verify fails an explicitly selected missing optional model', () => {
  const root = tempRoot();

  const result = createVerification({
    root,
    modelIds: ['musicgen-medium'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.selectedModels, 1);
  assert.equal(result.summary.missing, 1);
  assert.equal(result.summary.optionalSkipped, 0);
  assert.equal(result.artifacts[0].state, 'missing');
});

test('models:verify allows unselected optional models to remain absent', () => {
  const root = tempRoot();
  createDefaultInstallFixture(root);

  const result = createVerification({
    root,
    modelIds: [],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
  });

  const medium = result.artifacts.find(
    (row) => row.artifactId === 'musicgen-medium'
  );

  assert.equal(medium.state, 'missing');
  assert.equal(medium.requiredForSuccess, false);
  assert.equal(result.summary.optionalSkipped, 2);
  assert.equal(result.ok, true);
});

test('deep verification uses a container probe for Windows EACCES cache links', () => {
  const blocked = Object.assign(new Error('permission denied'), {
    code: 'EACCES',
  });
  const fakeFs = {
    statSync: () => {
      throw blocked;
    },
  };
  let calls = 0;

  const result = verifyRequiredFile('snapshot/model.safetensors', {
    fsApi: fakeFs,
    platform: 'win32',
    containerProbe: (filePath) => {
      calls += 1;
      assert.equal(filePath, 'snapshot/model.safetensors');
      return {
        verified: true,
        size: 1234,
      };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, {
    state: 'verified',
    mode: 'container-readonly',
    size: 1234,
    detail: 'verified non-empty file through read-only Linux container',
  });
});

test('deep verification reports unavailable when Windows cache links cannot be probed', () => {
  const blocked = Object.assign(new Error('permission denied'), {
    code: 'EPERM',
  });
  const fakeFs = {
    statSync: () => {
      throw blocked;
    },
  };

  const result = verifyRequiredFile('snapshot/model_config.json', {
    fsApi: fakeFs,
    platform: 'win32',
    containerProbe: () => ({
      verified: false,
      unavailable: true,
      detail: 'Docker image unavailable',
    }),
  });

  assert.equal(result.state, 'unavailable');
  assert.equal(result.mode, 'container-readonly');
  assert.match(result.detail, /Docker image unavailable/);
});

test('models:verify rejects a zero-byte DiffSinger checkpoint', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifacts = registry.artifacts.filter(
    (candidate) => candidate.providerId === 'diffsinger'
  );

  for (const artifact of artifacts) {
    createCheckpointFixture(root, artifact);
  }

  const acoustic = artifacts.find(
    (artifact) => artifact.artifactId === 'diffsinger-opencpop-acoustic'
  );
  const checkpoint = acoustic.verification.checkpointGlobs[0].replace(
    '*',
    '160000'
  );
  fs.writeFileSync(path.join(root, acoustic.destination, checkpoint), '');

  const result = createVerification({
    root,
    modelIds: [],
    providerIds: ['diffsinger'],
    artifactIds: [],
    platform: 'linux',
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.corrupt, 1);
  assert.equal(
    result.artifacts.find(
      (row) => row.artifactId === 'diffsinger-opencpop-acoustic'
    ).state,
    'corrupt'
  );
});


test('MusicGen initialization includes shared runtime Hugging Face dependencies', () => {
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'musicgen-small'
  );

  assert.deepEqual(
    huggingFaceDownloadReposForArtifact(artifact),
    [
      'facebook/musicgen-small',
      'facebook/encodec_32khz',
      't5-base',
    ]
  );
});

test('models:init dry-run plans a public HF download without mutation', () => {
  const root = tempRoot();
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: ['musicgen-small'],
    providerIds: [],
    artifactIds: [],
    dryRun: true,
    platform: 'linux',
    downloadExecutor: () => {
      calls += 1;
      throw new Error('dry-run must not execute downloads');
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.summary.plannedDownloads, 1);
  assert.equal(result.artifacts[0].action, 'would-download');
  assert.equal(fs.readdirSync(root).length, 0);
});

test('models:init downloads and verifies a missing public HF artifact', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'musicgen-small'
  );
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: ['musicgen-small'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
    downloadExecutor: (selectedArtifact, modelRoot) => {
      calls += 1;
      assert.equal(selectedArtifact.artifactId, artifact.artifactId);
      createHuggingFaceFixture(modelRoot, selectedArtifact);
      createMusicGenDependencyFixtures(
        modelRoot,
        selectedArtifact
      );
      return {
        repos: huggingFaceDownloadReposForArtifact(selectedArtifact).map(
          (repoId) => ({ repoId })
        ),
      };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.summary.downloaded, 1);
  assert.equal(result.summary.verified, 1);
  assert.equal(result.artifacts[0].action, 'downloaded');
  assert.equal(result.artifacts[0].state, 'verified');
});


test('models:init repairs a missing MusicGen runtime dependency instead of reporting cache-hit', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'musicgen-small'
  );
  createHuggingFaceFixture(root, artifact);
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: ['musicgen-small'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
    downloadExecutor: (selectedArtifact, modelRoot) => {
      calls += 1;
      createMusicGenDependencyFixtures(
        modelRoot,
        selectedArtifact
      );
      return {
        repos: huggingFaceDownloadReposForArtifact(selectedArtifact).map(
          (repoId) => ({ repoId })
        ),
      };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.artifacts[0].action, 'downloaded');
  assert.deepEqual(result.artifacts[0].missingRuntimeRepos, []);
});


test('pinned HF main ref normalization writes the exact revision with no newline', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'stable-audio-3-small-music'
  );

  createHuggingFaceFixture(root, artifact);

  const artifactRoot = path.join(root, artifact.destination);
  const repoCache =
    'models--' + artifact.source.repoId.replace(/\//g, '--');
  const refPath = path.join(
    artifactRoot,
    'hub',
    repoCache,
    'refs',
    'main'
  );

  fs.writeFileSync(
    refPath,
    artifact.source.revision + '\n',
    'utf8'
  );

  const result = normalizePinnedHuggingFaceMainRef(
    artifact,
    root
  );

  assert.equal(result.changed, true);
  assert.equal(
    fs.readFileSync(refPath, 'utf8'),
    artifact.source.revision
  );

  const second = normalizePinnedHuggingFaceMainRef(
    artifact,
    root
  );

  assert.equal(second.changed, false);
});

test('models:init normalizes a pinned HF ref on an otherwise verified cache hit', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'stable-audio-3-small-music'
  );

  createHuggingFaceFixture(root, artifact);

  const artifactRoot = path.join(root, artifact.destination);
  const repoCache =
    'models--' + artifact.source.repoId.replace(/\//g, '--');
  const refPath = path.join(
    artifactRoot,
    'hub',
    repoCache,
    'refs',
    'main'
  );

  fs.writeFileSync(
    refPath,
    artifact.source.revision + '\n',
    'utf8'
  );

  const result = createInitialization({
    root,
    modelIds: ['stable-audio-3-small-music'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
    credential: 'fixture-token',
    downloadExecutor: () => {
      throw new Error('verified cache must not download');
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.cacheHits, 1);
  assert.equal(result.artifacts[0].action, 'cache-hit');
  assert.equal(result.artifacts[0].cacheRefNormalized, true);
  assert.equal(
    fs.readFileSync(refPath, 'utf8'),
    artifact.source.revision
  );
});

test('models:init is idempotent for an already verified HF artifact', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) => candidate.artifactId === 'musicgen-small'
  );
  createHuggingFaceFixture(root, artifact);
  createMusicGenDependencyFixtures(root, artifact);
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: ['musicgen-small'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
    downloadExecutor: () => {
      calls += 1;
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.summary.cacheHits, 1);
  assert.equal(result.artifacts[0].action, 'cache-hit');
  assert.equal(result.artifacts[0].state, 'verified');
});

test('models:init blocks missing gated HF artifacts before download without credentials', () => {
  const root = tempRoot();
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: ['stable-audio-3-small-music'],
    providerIds: [],
    artifactIds: [],
    platform: 'linux',
    credential: null,
    downloadExecutor: () => {
      calls += 1;
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.summary.authenticationRequired, 1);
  assert.equal(result.artifacts[0].action, 'authenticate');
});

test('models:init offline blocks a missing HF artifact without mutation', () => {
  const root = tempRoot();
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: ['musicgen-small'],
    providerIds: [],
    artifactIds: [],
    offline: true,
    platform: 'linux',
    downloadExecutor: () => {
      calls += 1;
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.summary.offlineBlocked, 1);
  assert.equal(result.artifacts[0].action, 'offline-missing');
  assert.equal(fs.readdirSync(root).length, 0);
});

test('models:init never exposes the supplied HF credential in its result', () => {
  const root = tempRoot();
  const secret = 'hf_phase4_secret_should_never_escape';

  const result = createInitialization({
    root,
    modelIds: ['stable-audio-3-small-music'],
    providerIds: [],
    artifactIds: [],
    dryRun: true,
    platform: 'linux',
    credential: secret,
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifacts[0].action, 'would-download');
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test('archive member safety rejects ZIP traversal and absolute paths', () => {
  assert.equal(
    isSafeArchiveMemberPath(
      '0228_opencpop_ds100_rel/config.yaml'
    ),
    true
  );
  assert.equal(
    isSafeArchiveMemberPath(
      '0228_opencpop_ds100_rel/model_ckpt_steps_160000.ckpt'
    ),
    true
  );
  assert.equal(isSafeArchiveMemberPath('../escape.txt'), false);
  assert.equal(
    isSafeArchiveMemberPath(
      '0228_opencpop_ds100_rel/../../escape.txt'
    ),
    false
  );
  assert.equal(isSafeArchiveMemberPath('/absolute/path'), false);
  assert.equal(isSafeArchiveMemberPath('C:/absolute/path'), false);
  assert.equal(isSafeArchiveMemberPath('C:\\absolute\\path'), false);
});

test('models:init downloads and verifies the DiffSinger composite through the HTTP ZIP adapter', () => {
  const root = tempRoot();
  const calls = [];

  const result = createInitialization({
    root,
    modelIds: [],
    providerIds: ['diffsinger'],
    artifactIds: [],
    platform: 'linux',
    httpZipDownloadExecutor: (
      selectedArtifact,
      modelRoot
    ) => {
      calls.push(selectedArtifact.artifactId);
      createCheckpointFixture(
        modelRoot,
        selectedArtifact
      );
      return {
        bytesDownloaded: 1234,
        operationId:
          'fixture-' + selectedArtifact.artifactId,
      };
    },
  });

  assert.deepEqual(
    calls.sort(),
    [
      'diffsinger-hifigan-vocoder',
      'diffsinger-opencpop-acoustic',
      'diffsinger-xiaoma-pitch-estimator',
    ].sort()
  );
  assert.equal(result.ok, true);
  assert.equal(result.summary.selectedArtifacts, 3);
  assert.equal(result.summary.downloaded, 3);
  assert.equal(result.summary.verified, 3);
  assert.equal(result.summary.repairRequired, 0);

  for (const row of result.artifacts) {
    assert.equal(row.state, 'verified');
    assert.equal(row.action, 'downloaded');
    assert.equal(row.sourceKind, 'http-zip');
  }
});

test('models:init is idempotent for a complete DiffSinger composite', () => {
  const root = tempRoot();
  const registry = loadRegistry();

  for (const artifact of registry.artifacts.filter(
    (candidate) => candidate.providerId === 'diffsinger'
  )) {
    createCheckpointFixture(root, artifact);
  }

  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: [],
    providerIds: ['diffsinger'],
    artifactIds: [],
    platform: 'linux',
    httpZipDownloadExecutor: () => {
      calls += 1;
      throw new Error(
        'verified DiffSinger cache must not download'
      );
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.summary.cacheHits, 3);
  assert.equal(result.summary.downloaded, 0);

  for (const row of result.artifacts) {
    assert.equal(row.action, 'cache-hit');
    assert.equal(row.state, 'verified');
  }
});

test('models:init refuses to overwrite an incomplete DiffSinger destination', () => {
  const root = tempRoot();
  const registry = loadRegistry();
  const artifact = registry.artifacts.find(
    (candidate) =>
      candidate.artifactId ===
      'diffsinger-opencpop-acoustic'
  );
  const destination = path.join(
    root,
    artifact.destination
  );

  ensureFile(
    path.join(destination, 'config.yaml'),
    'partial'
  );

  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: [],
    providerIds: [],
    artifactIds: [
      'diffsinger-opencpop-acoustic',
    ],
    platform: 'linux',
    httpZipDownloadExecutor: () => {
      calls += 1;
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.summary.repairRequired, 1);
  assert.equal(
    result.artifacts[0].action,
    'repair-required'
  );
  assert.equal(
    fs.readFileSync(
      path.join(destination, 'config.yaml'),
      'utf8'
    ),
    'partial'
  );
});

test('models:init offline blocks missing DiffSinger packages without mutation', () => {
  const root = tempRoot();
  let calls = 0;

  const result = createInitialization({
    root,
    modelIds: [],
    providerIds: ['diffsinger'],
    artifactIds: [],
    offline: true,
    platform: 'linux',
    httpZipDownloadExecutor: () => {
      calls += 1;
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.summary.offlineBlocked, 3);
  assert.equal(result.summary.downloaded, 0);
  assert.equal(fs.readdirSync(root).length, 0);
});

test('models:init partial Phase 4 requires an explicit selector', () => {
  const root = tempRoot();

  assert.throws(
    () =>
      createInitialization({
        root,
        modelIds: [],
        providerIds: [],
        artifactIds: [],
        platform: 'linux',
      }),
    /requires an explicit --model, --provider, or --artifact selector/
  );
});

test('checkpoint wildcard matching handles DiffSinger checkpoint names', () => {
  const matcher = wildcardToRegExp('model_ckpt_steps_*.ckpt');

  assert.equal(matcher.test('model_ckpt_steps_160000.ckpt'), true);
  assert.equal(matcher.test('config.yaml'), false);
});

test('package exposes the read-only model plan command', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );

  assert.equal(
    pkg.scripts['models:plan'],
    'node scripts/model-manager.cjs plan'
  );
  assert.equal(
    pkg.scripts['models:verify'],
    'node scripts/model-manager.cjs verify'
  );
  assert.equal(
    pkg.scripts['models:init'],
    'node scripts/model-manager.cjs init'
  );
  assert.equal(
    pkg.scripts['test:model-manager'],
    'node --test scripts/model-manager.test.cjs'
  );
});
