const assert = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync } = require('node:fs');
const path = require('node:path');

const script = path.join(__dirname, 'start-all.cjs');
test('startup orchestrator exists', () => assert.ok(existsSync(script)));

test('reconciles all services without forcing healthy containers to restart', () => {
  const { reconcileDocker } = require(script);
  const calls = [];
  const run = (args) => {
    calls.push(args);
    if (args.includes('ps')) return 'healthy\nsick\nstopped\n';
    if (args[0] === 'inspect') {
      const id = args.at(-1);
      return JSON.stringify({ Running: id !== 'stopped', Health: { Status: id === 'sick' ? 'unhealthy' : 'healthy' } });
    }
    return '';
  };
  reconcileDocker(run, ['compose', '-f', 'test.yml']);
  assert.deepEqual(calls.filter((args) => args[0] === 'restart'), [['restart', 'sick']]);
  const up = calls.find((args) => args.includes('up'));
  for (const flag of ['--no-build', '--wait', '--wait-timeout']) assert.ok(up.includes(flag));
  assert.ok(calls.some((args) => args.includes('build') && args.includes('--provenance=false')));
  assert.ok(!up.includes('--force-recreate'));
});

test('Docker failure prevents successful reconciliation', () => {
  const { reconcileDocker } = require(script);
  assert.throws(() => reconcileDocker(() => { throw new Error('Docker unavailable'); }, ['compose']), /Docker unavailable/);
});

test('database credentials are required and encoded for the application URI', () => {
  const { applicationEnvironment } = require(script);
  assert.throws(() => applicationEnvironment({}), /MONGO_ROOT_PASSWORD/);
  const env = applicationEnvironment({ MONGO_ROOT_PASSWORD: 'root-test', MONGO_HARMONIA_PASSWORD: 'p@ss:/ word', JWT_SECRET: 'test-secret' });
  assert.equal(env.MONGODB_URI, 'mongodb://harmonia_app:p%40ss%3A%2F%20word@127.0.0.1:27017/harmonia?authSource=harmonia');
  assert.equal(env.PORT, '3000');
});

test('root credentials are URI-encoded for Mongo Express', () => {
  const { applicationEnvironment } = require(script);
  const env = applicationEnvironment({ MONGO_ROOT_PASSWORD: 'root@:/ pass', MONGO_HARMONIA_PASSWORD: 'app-test', JWT_SECRET: 'test-secret' });
  assert.equal(env.MONGO_EXPRESS_URL, 'mongodb://admin:root%40%3A%2F%20pass@mongo:27017/');
});

test('rejects a backend port that the frontend cannot reach', () => {
  const { applicationEnvironment } = require(script);
  assert.throws(() => applicationEnvironment({ MONGO_ROOT_PASSWORD: 'root-test', MONGO_HARMONIA_PASSWORD: 'app-test', JWT_SECRET: 'test-secret', PORT: '3100' }), /PORT=3000/);
});

test('explicit application database settings are preserved', () => {
  const { applicationEnvironment } = require(script);
  const env = { MONGO_ROOT_PASSWORD: 'root-test', MONGO_HARMONIA_PASSWORD: 'app-test', JWT_SECRET: 'test-secret', MONGODB_URI: 'mongodb://other/db', PORT: '3000' };
  assert.equal(applicationEnvironment(env).MONGODB_URI, env.MONGODB_URI);
});

test('occupied app ports fail without stopping the existing server', async () => {
  const { checkPort } = require(script);
  const server = require('node:net').createServer();
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  try {
    await assert.rejects(checkPort(server.address().port, 'Frontend'), /Frontend port .* unavailable/);
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
