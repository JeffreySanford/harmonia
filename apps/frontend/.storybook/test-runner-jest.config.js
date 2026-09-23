const { getJestConfig } = require('@storybook/test-runner');

const baseConfig = getJestConfig();

module.exports = {
  ...baseConfig,
  modulePathIgnorePatterns: [
    ...(baseConfig.modulePathIgnorePatterns || []),
    '<rootDir>/dist/',
    '<rootDir>/.nx/cache/',
  ],
};
