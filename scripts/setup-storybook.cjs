#!/usr/bin/env node
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'package.json');
const storybookMain = path.join(root, 'apps', 'frontend', '.storybook', 'main.ts');
const pnpm = 'pnpm';

function run(args) {
  const result = spawnSync(pnpm, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    // Windows cannot reliably spawn the pnpm.cmd shim directly from Node
    // (spawnSync can return EINVAL). Let cmd.exe resolve the shim instead.
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw new Error(`Cannot run pnpm ${args.join(' ')}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `pnpm ${args.join(' ')} failed with status ${result.status}`
    );
  }
}


function normalizeGeneratedStorybookConfig() {
  if (!existsSync(storybookMain)) {
    return;
  }

  let source = readFileSync(storybookMain, 'utf8');
  const original = source;

  source = source
    .replace(/^import \{ fileURLToPath \} from ["']node:url["'];\r?\n/m, '')
    .replace(/^import \{ dirname \} from ["']node:path["'];\r?\n/m, '');

  if (source !== original) {
    writeFileSync(storybookMain, source);
    console.log('Normalized generated Storybook main.ts for strict TypeScript.');
  }
}

function ensureScripts() {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

  pkg.scripts ||= {};
  pkg.scripts.storybook =
    'nx storybook frontend --ci=true --host=127.0.0.1 --port=4400';
  pkg.scripts['storybook:build'] = 'nx build-storybook frontend';
  pkg.scripts['storybook:test'] = 'nx run frontend:test-storybook';

  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
}

function main() {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

  if (!pkg.devDependencies?.['@nx/storybook']) {
    console.log('Installing @nx/storybook for the Nx 22 workspace...');
    run(['add', '-D', '-w', '@nx/storybook@22.1.3']);
  }

  if (!pkg.devDependencies?.['@storybook/test-runner']) {
    console.log('Installing Storybook 10-compatible interaction test runner...');
    run(['add', '-D', '-w', '@storybook/test-runner@^0.24.0']);
  }

  if (!existsSync(storybookMain)) {
    console.log('Generating Angular Storybook configuration with interaction tests...');
    run([
      'nx',
      'g',
      '@nx/angular:storybook-configuration',
      'frontend',
      '--interactionTests=true',
      '--generateStories=false',
      '--configureStaticServe=true',
      '--tsConfiguration=true',
      '--skipFormat=true',
      '--no-interactive',
    ]);
  } else {
    console.log('Storybook configuration already exists; generator skipped.');
  }

  normalizeGeneratedStorybookConfig();
  ensureScripts();

  console.log('Installing any package.json changes and refreshing pnpm-lock.yaml...');
  run(['install']);

  console.log('Validating the generated Storybook application...');
  run(['nx', 'build-storybook', 'frontend']);

  console.log('');
  console.log('STORYBOOK_SETUP_OK');
  console.log('Run Storybook with: pnpm storybook');
  console.log(
    'With Storybook running on port 4400, run interaction tests with: pnpm storybook:test'
  );
}

try {
  main();
} catch (error) {
  console.error('');
  console.error('STORYBOOK_SETUP_FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
