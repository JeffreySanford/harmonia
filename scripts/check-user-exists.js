#!/usr/bin/env node
/**
 * Check whether E2E test user exists in runtime DB
 * Usage: node scripts/check-user-exists.js
 * Reads MONGODB_URI from .env and E2E_TEST_USER_* variables
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
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

async function main() {
  const opts = parseArgs();
  const mongoUri =
    opts['mongo-uri'] ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/harmonia';
  const email = process.env.E2E_TEST_USER_EMAIL || 'test@harmonia.local';
  const username = process.env.E2E_TEST_USER_USERNAME || 'test';
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const dbName = mongoUri.split('/').pop().split('?')[0];
    const db = mongoose.connection.db;
    const users = db.collection('users');
    const user = await users.findOne({ $or: [{ email }, { username }] });
    if (user) {
      console.log('User exists:', {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      });
      process.exit(0);
    } else {
      console.log('Test user not found in DB:', {
        db: dbName,
        email,
        username,
      });
      process.exit(1);
    }
  } catch (err) {
    console.error('Error connecting to DB:', err.message);
    process.exit(2);
  } finally {
    await mongoose.disconnect();
  }
}

main();
