#!/usr/bin/env node
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const mongoContainer = 'harmonia-mongo-i9';

function fail(message) {
  console.error(`Repair failed: ${message}`);
  process.exitCode = 1;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: options.env || process.env,
  });

  if (result.error) {
    throw new Error(`Cannot run ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = options.capture
      ? [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
      : '';
    throw new Error(
      `${command} failed with status ${result.status}${details ? `: ${details}` : ''}`
    );
  }

  return result.stdout || '';
}

function upsertEnvValue(source, key, value) {
  const line = `${key}=${value}`;
  const matcher = new RegExp(`^${key}=.*$`, 'm');

  if (matcher.test(source)) {
    return source.replace(matcher, line);
  }

  const prefix = source && !source.endsWith('\n') ? '\n' : '';
  return `${source}${prefix}${line}\n`;
}

function maskedUri(uri) {
  return uri.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

function ensureMongoContainer() {
  const name = run(
    'docker',
    ['inspect', '--format', '{{.Name}}', mongoContainer],
    { capture: true }
  ).trim();

  if (name !== `/${mongoContainer}`) {
    throw new Error(`Expected Docker container ${mongoContainer}, got ${name || 'none'}`);
  }
}

function synchronizeApplicationUser(appPassword) {
  const mongoScript = [
    'const admin = db.getSiblingDB("admin");',
    'if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {',
    '  print("ROOT_AUTH_FAILED");',
    '  quit(2);',
    '}',
    'const h = db.getSiblingDB("harmonia");',
    'const existing = h.getUser("harmonia_app");',
    'const spec = {',
    '  pwd: process.env.NEW_HARMONIA_APP_PASSWORD,',
    '  roles: [{ role: "readWrite", db: "harmonia" }]',
    '};',
    'if (existing) {',
    '  h.updateUser("harmonia_app", spec);',
    '  print("HARMONIA_APP_UPDATED");',
    '} else {',
    '  h.createUser({ user: "harmonia_app", ...spec });',
    '  print("HARMONIA_APP_CREATED");',
    '}',
  ].join('\n');

  run('docker', [
    'exec',
    '-e',
    `NEW_HARMONIA_APP_PASSWORD=${appPassword}`,
    mongoContainer,
    'mongosh',
    '--quiet',
    '--eval',
    mongoScript,
  ]);
}

function verifyApplicationUser(appPassword) {
  const mongoScript = [
    'const h = db.getSiblingDB("harmonia");',
    'if (!h.auth("harmonia_app", process.env.HARMONIA_APP_PASSWORD)) {',
    '  print("HARMONIA_APP_AUTH_FAILED");',
    '  quit(2);',
    '}',
    'h.runCommand({ ping: 1 });',
    'print("HARMONIA_APP_AUTH_OK");',
  ].join('\n');

  run('docker', [
    'exec',
    '-e',
    `HARMONIA_APP_PASSWORD=${appPassword}`,
    mongoContainer,
    'mongosh',
    '--quiet',
    '--eval',
    mongoScript,
  ]);
}

function seedTestUser(env, mongoUri) {
  const username = env.E2E_TEST_USER_USERNAME || 'test-user';
  const email = env.E2E_TEST_USER_EMAIL || 'test-user@harmonia.local';
  const password = env.E2E_TEST_USER_PASSWORD || 'password';

  run(
    process.execPath,
    [
      path.join(root, 'scripts', 'add-test-user.js'),
      '--env=harmonia',
      `--username=${username}`,
      `--email=${email}`,
      `--password=${password}`,
      '--role=user',
    ],
    {
      env: {
        ...process.env,
        MONGODB_URI: mongoUri,
        E2E_TEST_USER_PASSWORD: password,
      },
    }
  );

  return { username, email };
}

function main() {
  if (!existsSync(envPath)) {
    throw new Error('.env is missing. Copy .env.example to .env first.');
  }

  ensureMongoContainer();

  let envText = readFileSync(envPath, 'utf8');
  let env = parseEnv(envText);

  const appPassword =
    env.MONGO_HARMONIA_PASSWORD?.trim() ||
    crypto.randomBytes(24).toString('hex');

  const username = env.E2E_TEST_USER_USERNAME || 'test-user';
  const email = env.E2E_TEST_USER_EMAIL || 'test-user@harmonia.local';
  const testPassword = env.E2E_TEST_USER_PASSWORD || 'password';

  const mongoUri =
    `mongodb://harmonia_app:${encodeURIComponent(appPassword)}` +
    '@127.0.0.1:27017/harmonia?authSource=harmonia';

  envText = upsertEnvValue(envText, 'MONGO_HARMONIA_PASSWORD', appPassword);
  envText = upsertEnvValue(envText, 'MONGODB_URI', mongoUri);
  envText = upsertEnvValue(envText, 'DEV_AUTOGEN_TEST_USER', 'false');
  envText = upsertEnvValue(envText, 'E2E_TEST_USER_USERNAME', username);
  envText = upsertEnvValue(envText, 'E2E_TEST_USER_EMAIL', email);
  envText = upsertEnvValue(envText, 'E2E_TEST_USER_PASSWORD', testPassword);
  writeFileSync(envPath, envText);

  env = parseEnv(envText);

  console.log('Local Harmonia database credentials prepared.');
  console.log(`MONGODB_URI=${maskedUri(env.MONGODB_URI)}`);
  console.log(`Test user: ${env.E2E_TEST_USER_USERNAME} / ${env.E2E_TEST_USER_EMAIL}`);
  console.log('Test password is stored in .env and is not echoed here.');

  synchronizeApplicationUser(appPassword);
  verifyApplicationUser(appPassword);
  seedTestUser(env, mongoUri);

  console.log('LOCAL_DB_AUTH_REPAIR_OK');
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
