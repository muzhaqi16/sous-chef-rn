/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '../..',
  testMatch: ['<rootDir>/e2e/tests/**/*.e2e.{js,ts}'],
  testSequencer: '<rootDir>/e2e/config/testSequencer.js',

  // ⭐ OPTIMIZED TIMEOUTS FOR ANDROID DEVICE
  testTimeout: 300000, // 5 minutes per test (device is slower than emulator)

  // Run tests serially (important for app reuse)
  maxWorkers: 1,

  // Detox integration
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testEnvironment: 'detox/runners/jest/testEnvironment',

  // Note: init.ts (which imports config/setup.ts) is loaded transitively
  // by all test files via helpers/auth.ts and helpers/flows.ts

  // ⭐ ENHANCED REPORTING FOR BETTER DEBUGGING
  reporters: ['detox/runners/jest/reporter'],

  // Verbose output for debugging
  verbose: true,

  // ⭐ BAIL EARLY ON FAILURE (for local development)
  // Set to false in CI for full test run
  bail: process.env.CI ? false : 1,

  // Clear mocks between tests for isolation
  clearMocks: true,

  // Collect coverage if needed (usually disabled for E2E)
  collectCoverage: false,

  // Error handling
  errorOnDeprecated: true,

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform TypeScript (inline, no preset needed)
  transform: {
    '^.+\\.(ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^#/(.*)$': '<rootDir>/src/$1',
    '^#generated$': '<rootDir>/src/graphql/generated',
    '^#hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^#components/(.*)$': '<rootDir>/src/components/$1',
    '^e2e/(.*)$': '<rootDir>/e2e/$1',
  },
};
