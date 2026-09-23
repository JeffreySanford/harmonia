#!/usr/bin/env node
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');

const root = process.cwd();
const pnpm = 'pnpm';
const isWindows = process.platform === 'win32';

function runSync(args) {
  const result = spawnSync(pnpm, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: isWindows,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed with status ${result.status}`);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        address && typeof address === 'object' ? address.port : null;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error('Could not allocate a free Storybook test port.'));
          return;
        }

        resolve(port);
      });
    });
  });
}

function waitForUrl(url, timeoutMs = 120000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if (
          response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 400
        ) {
          resolve();
          return;
        }

        retry();
      });

      request.on('error', retry);
      request.setTimeout(2000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(poll, 1000);
    };

    poll();
  });
}

function stopProcessTree(child) {
  if (!child?.pid) {
    return;
  }

  if (isWindows) {
    spawnSync(
      'taskkill',
      ['/PID', String(child.pid), '/T', '/F'],
      {
        stdio: 'ignore',
        shell: true,
      }
    );
    return;
  }

  child.kill('SIGTERM');
}

async function main() {
  console.log('Ensuring Chromium is available for Storybook interaction tests...');
  runSync(['exec', 'playwright', 'install', 'chromium']);

  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;

  console.log(`Starting isolated Storybook test server on ${url}...`);

  const server = spawn(
    pnpm,
    [
      'nx',
      'storybook',
      'frontend',
      '--ci=true',
      '--host=127.0.0.1',
      `--port=${port}`,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: isWindows,
    }
  );

  let serverExit = null;
  server.once('exit', (code, signal) => {
    serverExit = { code, signal };
  });

  try {
    await waitForUrl(`${url}/index.json`);

    if (serverExit) {
      throw new Error(
        `Storybook exited before testing (code=${serverExit.code}, signal=${serverExit.signal}).`
      );
    }

    // Give Storybook's manager/preview channel a moment to finish wiring after
    // index.json becomes reachable. This avoids racing a hot or partial server.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log(`Running Storybook interactions against ${url}...`);
    runSync([
      'exec',
      'test-storybook',
      '-c',
      'apps/frontend/.storybook',
      `--url=${url}`,
      '--no-cache',
    ]);

    console.log('STORYBOOK_INTERACTIONS_OK');
  } finally {
    console.log('Stopping isolated Storybook test server...');
    stopProcessTree(server);
  }
}

main().catch((error) => {
  console.error('STORYBOOK_INTERACTIONS_FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
