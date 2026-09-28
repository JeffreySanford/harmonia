#!/usr/bin/env node

const crypto = require('node:crypto');
const {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const mongoose = require('mongoose');

const defaultRoot =
  path.resolve(__dirname, '..');

function fileHash(filename) {
  return crypto
    .createHash('sha256')
    .update(readFileSync(filename))
    .digest('hex');
}

function inside(root, candidate) {
  const relative =
    path.relative(root, candidate);

  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveEnvironment(root) {
  const envFile =
    path.join(root, '.env');

  const fileEnv =
    existsSync(envFile)
      ? parseEnv(
          readFileSync(
            envFile,
            'utf8'
          )
        )
      : {};

  const env = {
    ...fileEnv,
    ...process.env,
  };

  if (
    !env.MONGODB_URI &&
    env.MONGO_HARMONIA_PASSWORD
  ) {
    env.MONGODB_URI =
      `mongodb://harmonia_app:${encodeURIComponent(
        env.MONGO_HARMONIA_PASSWORD
      )}@127.0.0.1:27017/harmonia?authSource=harmonia`;
  }

  return env;
}

function loadManifest(root) {
  const seedRoot =
    path.resolve(
      root,
      'seeds',
      'generated-songs'
    );

  const manifestPath =
    path.join(
      seedRoot,
      'manifest.json'
    );

  const manifest =
    JSON.parse(
      readFileSync(
        manifestPath,
        'utf8'
      )
    );

  if (
    manifest.schema !==
      'harmonia-generated-song-seed-v1' ||
    manifest.count !== 8 ||
    !Array.isArray(manifest.items) ||
    manifest.items.length !== 8
  ) {
    throw new Error(
      'Generated-song manifest contract is invalid.'
    );
  }

  return {
    seedRoot,
    manifest,
  };
}

function readDescription(
  seedRoot,
  item
) {
  const relativePrompt =
    item.sidecars?.['prompt.txt'];

  if (!relativePrompt) {
    return undefined;
  }

  const filename =
    path.resolve(
      seedRoot,
      relativePrompt
    );

  if (
    !inside(seedRoot, filename) ||
    !existsSync(filename)
  ) {
    return undefined;
  }

  const value =
    readFileSync(
      filename,
      'utf8'
    ).trim();

  return value || undefined;
}

function sameMetadata(
  existing,
  desired
) {
  const current =
    existing || {};

  return (
    current.model === desired.model &&
    current.seedKey === desired.seedKey
  );
}

function recordMatches(
  existing,
  desired
) {
  return (
    existing.type === desired.type &&
    existing.title === desired.title &&
    existing.description === desired.description &&
    existing.fileUrl === desired.fileUrl &&
    existing.fileType === desired.fileType &&
    existing.fileSize === desired.fileSize &&
    existing.isDemo === true &&
    existing.isPublic === false &&
    sameMetadata(
      existing.metadata,
      desired.metadata
    )
  );
}

async function seedGeneratedSongs(options = {}) {
  const root =
    options.root || defaultRoot;

  const env =
    options.env ||
    resolveEnvironment(root);

  const enabled =
    String(
      env.HARMONIA_SEED_GENERATED_SONGS ??
        'true'
    ).toLowerCase() !== 'false';

  if (!enabled) {
    console.log(
      'Generated demo song seed: disabled.'
    );

    return {
      skipped: true,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      copied: 0,
    };
  }

  const mongoUri =
    options.mongoUri ||
    env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      'Generated demo song seed requires MONGODB_URI.'
    );
  }

  const {
    seedRoot,
    manifest,
  } = loadManifest(root);

  const username =
    env.HARMONIA_DEMO_LIBRARY_USERNAME ||
    env.E2E_TEST_USER_USERNAME ||
    'test-user';

  const email =
    env.HARMONIA_DEMO_LIBRARY_EMAIL ||
    env.E2E_TEST_USER_EMAIL ||
    'test-user@harmonia.local';

  const connection =
    mongoose.createConnection(
      mongoUri,
      {
        serverSelectionTimeoutMS: 10000,
      }
    );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let copied = 0;

  try {
    await connection.asPromise();

    const db =
      connection.db;

    const owner =
      await db
        .collection('users')
        .findOne({
          $or: [
            { username },
            { email },
          ],
        });

    if (!owner) {
      throw new Error(
        `Generated demo song owner not found: ${username} / ${email}`
      );
    }

    const ownerId =
      owner._id;

    const ownerIdText =
      ownerId.toString();

    const userRoot =
      path.resolve(
        root,
        'uploads',
        'library',
        ownerIdText
      );

    mkdirSync(
      userRoot,
      {
        recursive: true,
      }
    );

    const library =
      db.collection(
        'libraryitems'
      );

    for (
      const item
      of manifest.items
    ) {
      if (
        item.isDemo !== true ||
        typeof item.seedKey !== 'string' ||
        typeof item.assetPath !== 'string'
      ) {
        throw new Error(
          `Invalid demo manifest entry: ${item.title || 'untitled'}`
        );
      }

      const source =
        path.resolve(
          seedRoot,
          item.assetPath
        );

      if (
        !inside(seedRoot, source) ||
        !existsSync(source)
      ) {
        throw new Error(
          `Missing or unsafe seed asset: ${item.assetPath}`
        );
      }

      const sourceStats =
        statSync(source);

      if (
        sourceStats.size !==
          item.bytes ||
        fileHash(source) !==
          item.sha256
      ) {
        throw new Error(
          `Seed asset integrity failure: ${item.assetPath}`
        );
      }

      const extension =
        path.extname(source)
          .toLowerCase();

      const storageName =
        `demo-${item.seedKey}${extension}`;

      const destination =
        path.resolve(
          userRoot,
          storageName
        );

      if (
        !inside(
          userRoot,
          destination
        )
      ) {
        throw new Error(
          `Unsafe demo destination: ${storageName}`
        );
      }

      let needsCopy =
        !existsSync(destination);

      if (!needsCopy) {
        const destinationStats =
          statSync(destination);

        needsCopy =
          destinationStats.size !==
            item.bytes ||
          fileHash(destination) !==
            item.sha256;
      }

      if (needsCopy) {
        copyFileSync(
          source,
          destination
        );

        if (
          statSync(destination).size !==
            item.bytes ||
          fileHash(destination) !==
            item.sha256
        ) {
          throw new Error(
            `Copied demo verification failed: ${item.title}`
          );
        }

        copied += 1;
      }

      const fileUrl =
        `/uploads/library/${ownerIdText}/${storageName}`;

      const description =
        readDescription(
          seedRoot,
          item
        );

      const desired = {
        userId: ownerId,
        type: item.type,
        title: item.title,
        description:
          description ?? null,
        fileUrl,
        fileType: item.fileType,
        fileSize: item.bytes,
        metadata: {
          model: item.model,
          seedKey: item.seedKey,
        },
        isDemo: true,
        isPublic: false,
      };

      const existing =
        await library.findOne({
          userId: ownerId,
          fileUrl,
        });

      if (!existing) {
        const now =
          new Date();

        await library.insertOne({
          ...desired,
          playCount: 0,
          downloadCount: 0,
          createdAt: now,
          updatedAt: now,
        });

        inserted += 1;
        continue;
      }

      if (
        recordMatches(
          existing,
          desired
        )
      ) {
        unchanged += 1;
        continue;
      }

      await library.updateOne(
        {
          _id: existing._id,
        },
        {
          $set: {
            ...desired,
            updatedAt:
              new Date(),
          },
        }
      );

      updated += 1;
    }

    console.log(
      [
        'GENERATED_SONG_SEED_OK',
        `owner=${username}`,
        `inserted=${inserted}`,
        `updated=${updated}`,
        `unchanged=${unchanged}`,
        `copied=${copied}`,
      ].join(' ')
    );

    return {
      skipped: false,
      inserted,
      updated,
      unchanged,
      copied,
    };
  } finally {
    await connection.close();
  }
}

module.exports = {
  loadManifest,
  resolveEnvironment,
  seedGeneratedSongs,
};

if (
  require.main === module
) {
  seedGeneratedSongs()
    .catch((error) => {
      console.error(
        error instanceof Error
          ? error.message
          : String(error)
      );

      process.exitCode = 1;
    });
}
