'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  cases,
} = require('../tests/model-qualification/model-generation-cases.cjs');

const qualifiedModels = [
  'musicgen-small',
  'musicgen-stereo-small',
  'diffsinger-acoustic-hifigan',
  'stable-audio-3-small-music',
  'acestep-v15-turbo-06b',
];

test('qualification case ids are unique', () => {
  const ids = cases.map((entry) => entry.id);
  assert.equal(
    new Set(ids).size,
    ids.length
  );
});

test('every current qualified runtime has smoke and deep generation cases', () => {
  for (const modelId of qualifiedModels) {
    const modelCases = cases.filter(
      (entry) => entry.modelId === modelId
    );

    assert.ok(
      modelCases.some(
        (entry) => entry.profile === 'smoke'
      ),
      `${modelId} requires a smoke generation case`
    );

    assert.ok(
      modelCases.some(
        (entry) => entry.profile === 'deep'
      ),
      `${modelId} requires a deep generation case`
    );
  }
});

test('all generation cases have meaningful titles and purposes', () => {
  for (const entry of cases) {
    assert.ok(entry.id);
    assert.ok(entry.title);
    assert.ok(entry.purpose);
    assert.ok(
      ['smoke', 'deep', 'manual'].includes(entry.profile)
    );
    assert.ok(entry.parameters);
    assert.ok(entry.expect);
  }
});

test('instrumental providers carry descriptive conditioning', () => {
  for (const entry of cases.filter(
    (candidate) =>
      candidate.modelId.startsWith('musicgen-') ||
      candidate.modelId ===
        'stable-audio-3-small-music'
  )) {
    assert.ok(
      entry.parameters.prompt?.length >= 80,
      `${entry.id} requires a substantial prompt`
    );

    assert.ok(
      Number(entry.parameters.duration) > 0
    );

    assert.ok(
      entry.parameters.genre
    );

    assert.ok(
      Number(entry.parameters.bpm) > 0
    );

    assert.ok(
      Array.isArray(
        entry.parameters.instruments
      )
    );

    assert.ok(
      entry.parameters.instruments.length >= 3
    );
  }
});

test('DiffSinger cases are score-native and structurally matched', () => {
  for (const entry of cases.filter(
    (candidate) =>
      candidate.modelId ===
      'diffsinger-acoustic-hifigan'
  )) {
    const notes =
      entry.parameters.notes
        .split('|')
        .filter(Boolean);

    const durations =
      entry.parameters.notesDuration
        .split('|')
        .filter(Boolean);

    assert.equal(
      entry.parameters.inputType,
      'word'
    );

    assert.ok(
      entry.parameters.text.length > 0
    );

    assert.equal(
      notes.length,
      durations.length
    );

    assert.ok(
      durations.every(
        (value) =>
          Number.isFinite(Number(value)) &&
          Number(value) > 0
      )
    );
  }
});

test('ACE-Step cases include original supplied lyrics and conditioning', () => {
  for (const entry of cases.filter(
    (candidate) =>
      candidate.modelId ===
      'acestep-v15-turbo-06b'
  )) {
    assert.ok(
      entry.parameters.prompt.length >= 100
    );

    assert.ok(
      entry.parameters.lyrics.includes(
        '[Verse'
      ) ||
      entry.parameters.lyrics.includes(
        '[Verso'
      )
    );

    assert.ok(
      entry.parameters.lyrics.includes(
        '[Chorus'
      ) ||
      entry.parameters.lyrics.includes(
        '[Coro'
      )
    );

    assert.ok(
      ['en', 'es'].includes(
        entry.parameters.vocalLanguage
      )
    );

    assert.ok(
      Number(entry.parameters.duration) >= 10
    );

    assert.ok(
      Number.isInteger(
        entry.parameters.seed
      )
    );
  }
});

test(
  'manual Chinese opera case is opt-in and exactly 30 seconds',
  () => {
    const entry =
      cases.find(
        (candidate) =>
          candidate.id ===
          'diffsinger-dusk-drums-opera'
      );

    assert.ok(entry);
    assert.equal(
      entry.profile,
      'manual'
    );

    const duration =
      entry.parameters
        .notesDuration
        .split('|')
        .map(Number)
        .reduce(
          (sum, value) =>
            sum + value,
          0
        );

    assert.equal(
      duration,
      30
    );
  }
);

test(
  'qualification runner supports selective execution and renewable tokens',
  () => {
    const fs =
      require('node:fs');

    const runner =
      fs.readFileSync(
        'scripts/qualify-model-hardware-matrix.cjs',
        'utf8'
      );

    const selector =
      fs.readFileSync(
        'scripts/runtime-selection-client.cjs',
        'utf8'
      );

    assert.match(
      runner,
      /--case/
    );

    assert.match(
      runner,
      /--model/
    );

    assert.match(
      runner,
      /--list/
    );

    assert.match(
      runner,
      /latest-samples/
    );

    assert.match(
      selector,
      /tokenProvider/
    );
  }
);

test(
  'qualification runner uses renewable auth for both protected artifact downloads',
  () => {
    const fs =
      require('node:fs');

    const runner =
      fs.readFileSync(
        'scripts/qualify-model-hardware-matrix.cjs',
        'utf8'
      );

    assert.match(
      runner,
      /getArtifact\(\s*backendBase,\s*artifactPath,\s*auth\s*\)/
    );

    assert.match(
      runner,
      /getArtifact\(\s*frontendBase,\s*artifactPath,\s*auth\s*\)/
    );

    assert.doesNotMatch(
      runner,
      /getArtifact\(\s*frontendBase,\s*artifactPath,\s*token\s*\)/
    );
  }
);
