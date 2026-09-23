#!/usr/bin/env node
const { execFileSync } = require('node:child_process');

const backendBase = 'http://localhost:3000';
const modelId = 'diffsinger-acoustic-hifigan';
const containerName = 'harmonia-diffsinger';

async function request(url, options = {}, timeoutMs = 30000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} -> HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`
    );
  }

  return body;
}

function docker(args) {
  return execFileSync('docker', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function diagnostics() {
  console.error('');
  console.error('=== DIFFSINGER CONTAINER STATE ===');
  try {
    console.error(
      docker([
        'inspect',
        '--format',
        'running={{.State.Running}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} exit={{.State.ExitCode}} error={{.State.Error}}',
        containerName,
      ])
    );
  } catch (error) {
    console.error(error.stderr?.toString?.() || error.message);
  }

  console.error('');
  console.error('=== DIFFSINGER LOG TAIL ===');
  try {
    console.error(docker(['logs', '--tail', '200', containerName]));
  } catch (error) {
    console.error(error.stderr?.toString?.() || error.message);
  }
}

async function main() {
  console.log('============================================================');
  console.log(' DIFFSINGER RUNTIME QUALIFICATION');
  console.log('============================================================');

  await request(`${backendBase}/api/__health`);
  console.log('Backend is reachable.');

  const selected = await request(
    `${backendBase}/api/music/runtime/select`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId }),
    },
    5 * 60 * 1000
  );

  console.log(
    `Runtime selected: ${selected?.modelName || selected?.modelId || modelId} (${selected?.state || 'unknown'})`
  );

  if (
    selected?.providerId !== 'diffsinger' ||
    selected?.modelId !== modelId ||
    selected?.state !== 'ready' ||
    selected?.healthy !== true
  ) {
    throw new Error(
      `DiffSinger selection did not reach healthy ready state: ${JSON.stringify(selected)}`
    );
  }

  const status = await request(`${backendBase}/api/music/runtime/status`);

  if (
    status?.providerId !== 'diffsinger' ||
    status?.modelId !== modelId ||
    status?.state !== 'ready' ||
    status?.healthy !== true
  ) {
    throw new Error(
      `DiffSinger runtime status is not healthy/ready: ${JSON.stringify(status)}`
    );
  }

  const state = JSON.parse(
    docker(['inspect', '--format', '{{json .State}}', containerName])
  );

  if (!state.Running) {
    throw new Error('DiffSinger container is not running after selection');
  }

  if (state.Health?.Status !== 'healthy') {
    throw new Error(
      `DiffSinger container health is ${state.Health?.Status || 'missing'}`
    );
  }

  docker([
    'exec',
    containerName,
    'bash',
    '-lc',
    'test -f /tmp/harmonia-runtime-ready',
  ]);

  const checkpointSummary = docker([
    'exec',
    containerName,
    'bash',
    '-lc',
    "find /workspace/models/diffsinger -type f \\( -name '*.ckpt' -o -name '*.pt' -o -name '*.pth' \\) 2>/dev/null | sed -n '1,20p'",
  ]);

  console.log('');
  console.log('============================================================');
  console.log(' DIFFSINGER RUNTIME QUALIFICATION PASSED');
  console.log('============================================================');
  console.log(`providerId          = ${status.providerId}`);
  console.log(`modelId             = ${status.modelId}`);
  console.log(`state               = ${status.state}`);
  console.log(`healthy             = ${status.healthy}`);
  console.log(`container running   = ${state.Running}`);
  console.log(`container health    = ${state.Health?.Status}`);
  console.log('runtime sentinel    = present');
  console.log(
    `model checkpoints   = ${checkpointSummary ? '\n' + checkpointSummary : 'none discovered'}`
  );
  console.log('DIFFSINGER_RUNTIME_QUALIFICATION_OK');
}

main().catch((error) => {
  console.error('');
  console.error('DIFFSINGER_RUNTIME_QUALIFICATION_FAILED');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  diagnostics();
  process.exitCode = 1;
});
