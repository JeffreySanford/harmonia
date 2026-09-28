const assert =
  require('node:assert/strict');

const { test } =
  require('node:test');

const crypto =
  require('node:crypto');

const {
  existsSync,
  readFileSync,
  statSync,
} =
  require('node:fs');

const path =
  require('node:path');

const {
  loadManifest,
  seedGeneratedSongs,
} =
  require('./seed-generated-songs.cjs');

const root =
  path.resolve(
    __dirname,
    '..'
  );

function sha256(filename) {
  return crypto
    .createHash('sha256')
    .update(
      readFileSync(filename)
    )
    .digest('hex');
}

test(
  'generated-song manifest contains eight valid demo assets',
  () => {
    const {
      seedRoot,
      manifest,
    } =
      loadManifest(root);

    assert.equal(
      manifest.schema,
      'harmonia-generated-song-seed-v1'
    );

    assert.equal(
      manifest.count,
      8
    );

    assert.equal(
      manifest.items.length,
      8
    );

    const keys =
      new Set();

    for (
      const item
      of manifest.items
    ) {
      assert.equal(
        item.isDemo,
        true
      );

      assert.equal(
        keys.has(item.seedKey),
        false,
        `duplicate seed key ${item.seedKey}`
      );

      keys.add(
        item.seedKey
      );

      const asset =
        path.resolve(
          seedRoot,
          item.assetPath
        );

      assert.equal(
        existsSync(asset),
        true,
        `missing ${item.assetPath}`
      );

      assert.equal(
        statSync(asset).size,
        item.bytes
      );

      assert.equal(
        sha256(asset),
        item.sha256
      );
    }
  }
);

test(
  'generated-song seed can be disabled without opening MongoDB',
  async () => {
    const result =
      await seedGeneratedSongs({
        root,
        env: {
          HARMONIA_SEED_GENERATED_SONGS:
            'false',
        },
        mongoUri:
          'mongodb://invalid.invalid/harmonia',
      });

    assert.deepEqual(
      result,
      {
        skipped: true,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        copied: 0,
      }
    );
  }
);
