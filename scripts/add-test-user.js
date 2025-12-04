#!/usr/bin/env node
/*
 * Add test user script for local Mongo DB (harmonia_test/harmonia)
 * Usage: node scripts/add-test-user.js --env=harmonia_test --username=e2e_user --email=e2e.user@harmonia.local --password=UserP@ssw0rd! --role=user
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

function readEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return {};
  const contents = fs.readFileSync(envFilePath, 'utf8');
  const lines = contents.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const arg of args) {
    const [k, v] = arg.split('=');
    if (k && v) {
      const key = k.replace(/^--/, '');
      opts[key] = v;
    }
  }
  return opts;
}

(async function main() {
  try {
    const cwd = process.cwd();
    const envPath = path.resolve(cwd, '.env');
    const env = readEnvFile(envPath);

    const opts = parseArgs();
    const targetEnv = opts.env || 'harmonia_test';

    // Read necessary variables
    const MONGO_ROOT_PASSWORD =
      process.env.MONGO_ROOT_PASSWORD || env.MONGO_ROOT_PASSWORD;

    // Prefer explicit mongoUri if provided via --mongo-uri or MONGODB_URI
    const explicitMongoUri = opts.mongoUri || process.env.MONGODB_URI || null;
    let connectUri;
    if (explicitMongoUri) {
      // use the explicit URI directly; if it does not include a DB path, append the target DB name
      const hasDbPath = /\/[^/?#]+/.test(
        explicitMongoUri.replace(/^[^:]+:\/\//, '')
      );
      connectUri = explicitMongoUri;
      if (!hasDbPath) {
        // append the DB name
        connectUri = explicitMongoUri.replace(/\/?$/, `/${targetEnv}`);
      }
    } else {
      // default to admin local connection using ROOT password
      if (!MONGO_ROOT_PASSWORD) {
        console.error('MONGO_ROOT_PASSWORD not available in env or .env file');
        process.exit(1);
      }
      connectUri = `mongodb://admin:${encodeURIComponent(
        MONGO_ROOT_PASSWORD
      )}@localhost:27017/${targetEnv}?authSource=admin`;
    }

    console.log(
      `Connecting to ${targetEnv} at ${connectUri.replace(/:.*@/, ':***@')}`
    );

    await mongoose.connect(connectUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;

    const username = opts.username || 'e2e_user';
    const email = opts.email || 'e2e.user@harmonia.local';
    let password = opts.password || null;
    const encryptedPasswordEnv =
      process.env.ENCRYPTED_TEST_PASSWORD || opts.encryptedPassword || null;
    const encryptionKey =
      process.env.ENCRYPTION_KEY || opts.encryptionKey || null;

    if (!password && encryptedPasswordEnv) {
      if (!encryptionKey) {
        console.error(
          'ENCRYPTION_KEY must be set in env to decrypt ENCRYPTED_TEST_PASSWORD'
        );
        process.exit(1);
      }
      // decrypt encrypted value format: base64(iv):base64(ciphertext)
      const crypto = require('crypto');
      const [ivb64, cipherb64] = encryptedPasswordEnv.split(':');
      if (!ivb64 || !cipherb64) {
        console.error(
          'ENCRYPTED_TEST_PASSWORD must be in format <iv64>:<cipher64>'
        );
        process.exit(1);
      }
      const iv = Buffer.from(ivb64, 'base64');
      let keyBuf;
      try {
        keyBuf = Buffer.from(encryptionKey, 'base64');
      } catch (e) {
        keyBuf = Buffer.from(encryptionKey);
      }
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
      const dec = Buffer.concat([
        decipher.update(Buffer.from(cipherb64, 'base64')),
        decipher.final(),
      ]);
      password = dec.toString('utf8');
    }
    // Require password for test users; prefer env var E2E_TEST_USER_PASSWORD
    password = password || process.env.E2E_TEST_USER_PASSWORD;
    if (!password) {
      console.error(
        'Password must be provided either via --password, ENCRYPTED_TEST_PASSWORD with ENCRYPTION_KEY, or E2E_TEST_USER_PASSWORD in .env'
      );
      process.exit(1);
    }
    const role = opts.role || 'user';

    // Hash password
    const saltRounds = 10;
    const hashed = await bcrypt.hash(password, saltRounds);

    // Upsert the user
    const collection = db.collection('users');
    const existing = await collection.findOne({
      $or: [{ email }, { username }],
    });
    if (existing) {
      console.log('User already exists. Replacing...');
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            username,
            email,
            password: hashed,
            role,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      await collection.insertOne({
        username,
        email,
        password: hashed,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(
      `✅ Test user (${username} / ${email}) inserted/updated in ${targetEnv} with role: ${role}`
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error inserting test user:', err);
    process.exit(1);
  }
})();
