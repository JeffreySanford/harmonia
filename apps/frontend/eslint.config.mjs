import nx from '@nx/eslint-plugin';
import baseConfig from '../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-inject': 'error',
      // Allow NgModule-declared components (do not require standalone: true)
      '@angular-eslint/prefer-standalone': 'off',
    }
  }
];
