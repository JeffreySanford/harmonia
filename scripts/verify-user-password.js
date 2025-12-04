#!/usr/bin/env node
/**
 * Verify E2E test user's password against stored hash in DB
 * Usage: node scripts/verify-user-password.js --mongo-uri=<uri> --emailOrUsername=<email|username> --password=<plain>
 * If no flags are provided, it reads from .env E2E_TEST_USER_* and MONGODB_URI
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const a of args) {
    const [k, v] = a.split('=');
    if (k && v) opts[k.replace(/^--/, '')] = v;
  }
  return opts;
}

(async () => {
  const opts = parseArgs();
  const mongoUri =
    opts['mongo-uri'] ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/harmonia';
  const email =
    opts.email ||
    opts['emailOrUsername'] ||
    process.env.E2E_TEST_USER_EMAIL ||
    'test@harmonia.local';
  const username =
    opts.username ||
    opts['emailOrUsername'] ||
    process.env.E2E_TEST_USER_USERNAME ||
    'test';
  const password =
    opts.password || process.env.E2E_TEST_USER_PASSWORD || 'password';

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const dbName = mongoUri.split('/').pop().split('?')[0];
    const db = mongoose.connection.db;
    const users = db.collection('users');
    const query = { $or: [{ email }, { username }] };
    const user = await users.findOne(query);
    if (!user) {
      console.error('User not found:', { db: dbName, email, username });
      process.exit(2);
    }

    console.log('Found user:', {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    if (!user.password) {
      console.error('User has no password hash in DB');
      process.exit(3);
    }

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      console.log(
        `✅ Password for user ${
          user.username || user.email
        } matches the provided password.`
      );
      process.exit(0);
    } else {
      console.error(
        `❌ Password for user ${
          user.username || user.email
        } does NOT match provided password.`
      );
      console.log(
        'NOTE: If you see this, check if multiple user documents exist or if the runtime DB differs from the seeded DB.'
      );
      process.exit(4);
    }
  } catch (err) {
    console.error('Error verifying password:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
