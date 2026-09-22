const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { reconcileDocker } = require('./start-all.cjs');

test('real Compose lifecycle: missing, healthy, stopped, dirty config/image, unhealthy', {
  skip: process.env.RUN_DOCKER_START_TESTS !== '1',
  timeout: 180000,
}, async () => {
  // No host ports or volumes; this project cannot touch the development stack.
  const directory = mkdtempSync(path.join(tmpdir(), 'harmonia-start-test-'));
  const project = `harmonia-start-test-${process.pid}`;
  const file = path.join(directory, 'compose.json');
  const compose = ['compose', '--project-name', project, '-f', file];
  const docker = (args) => {
    const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
    return result.stdout;
  };
  const writeConfig = (version) => writeFileSync(file, JSON.stringify({ services: { probe: {
    build: { context: directory },
    image: `${project}:local`,
    pull_policy: 'never',
    labels: { version },
    command: ['sh', '-c', 'touch /tmp/ready; exec sleep infinity'],
    healthcheck: { test: ['CMD', 'test', '-f', '/tmp/ready'], interval: '1s', timeout: '1s', retries: 1 },
  } } }));
  const writeImage = (version) => writeFileSync(path.join(directory, 'Dockerfile'), `FROM alpine:3\nLABEL test.version="${version}"\n`);
  const container = () => JSON.parse(docker(['inspect', docker([...compose, 'ps', '--all', '--quiet']).trim()]))[0];
  try {
    writeImage('1');
    writeConfig('1');
    reconcileDocker(docker, compose);
    const first = container();
    assert.equal(first.State.Health.Status, 'healthy');

    reconcileDocker(docker, compose);
    const second = container();
    assert.equal(second.Image, first.Image, 'Unchanged cached build must retain its image ID');
    assert.equal(second.Config.Labels['com.docker.compose.config-hash'], first.Config.Labels['com.docker.compose.config-hash']);
    assert.equal(second.Id, first.Id);
    assert.equal(container().State.StartedAt, first.State.StartedAt);

    docker([...compose, 'stop']);
    reconcileDocker(docker, compose);
    assert.equal(container().Id, first.Id);
    assert.equal(container().State.Health.Status, 'healthy');

    writeConfig('2');
    reconcileDocker(docker, compose);
    const changedConfig = container();
    assert.notEqual(changedConfig.Id, first.Id);

    writeImage('2');
    reconcileDocker(docker, compose);
    const changedImage = container();
    assert.notEqual(changedImage.Id, changedConfig.Id);
    assert.notEqual(changedImage.Image, changedConfig.Image);

    docker(['exec', changedImage.Id, 'rm', '/tmp/ready']);
    for (let attempt = 0; attempt < 20 && container().State.Health.Status !== 'unhealthy'; attempt++) await delay(500);
    assert.equal(container().State.Health.Status, 'unhealthy');
    reconcileDocker(docker, compose);
    const recovered = container();
    assert.equal(recovered.Id, changedImage.Id);
    assert.notEqual(recovered.State.StartedAt, changedImage.State.StartedAt);
    assert.equal(recovered.State.Health.Status, 'healthy');
  } finally {
    try {
      docker([...compose, 'down', '--rmi', 'all']);
    } finally {
      const resolved = path.resolve(directory);
      assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
      assert.ok(path.basename(resolved).startsWith('harmonia-start-test-'));
      rmSync(resolved, { recursive: true, force: true });
    }
  }
});
