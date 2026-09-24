const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createPlan,
  createVerification,
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
    pkg.scripts['test:model-manager'],
    'node --test scripts/model-manager.test.cjs'
  );
});
