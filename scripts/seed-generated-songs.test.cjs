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

function readLfsPointer(filename) {
  const stats =
    statSync(filename);

  /*
   * GitHub Actions normally checks out LFS-managed files
   * as small pointer files unless checkout enables LFS.
   * Local development normally has the real WAV materialized.
   */
  if (stats.size > 1024) {
    return null;
  }

  const source =
    readFileSync(
      filename,
      'utf8'
    );

  const lines =
    source.split(/\r?\n/);

  if (
    lines[0] !==
    'version https://git-lfs.github.com/spec/v1'
  ) {
    return null;
  }

  const oidLine =
    lines.find(
      (line) =>
        line.startsWith(
          'oid sha256:'
        )
    );

  const sizeLine =
    lines.find(
      (line) =>
        line.startsWith(
          'size '
        )
    );

  assert.ok(
    oidLine,
    `missing LFS oid in ${filename}`
  );

  assert.ok(
    sizeLine,
    `missing LFS size in ${filename}`
  );

  return {
    sha256:
      oidLine.slice(
        'oid sha256:'.length
      ),
    bytes:
      Number(
        sizeLine.slice(
          'size '.length
        )
      ),
  };
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

      const lfsPointer =
        readLfsPointer(asset);

      if (lfsPointer) {
        assert.equal(
          lfsPointer.bytes,
          item.bytes
        );

        assert.equal(
          lfsPointer.sha256,
          item.sha256
        );
      } else {
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
