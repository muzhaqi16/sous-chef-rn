/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '../..',
  testMatch: ['<rootDir>/e2e/tests/**/*.e2e.{js,ts}'],
  testSequencer: '<rootDir>/e2e/config/testSequencer.js',

  // This is the timeout that actually applies — it overrides the one in
  // .detoxrc.js. Five minutes per test meant a single stuck test took five
  // minutes to report, which is long enough that people stop watching. Slow
  // physical devices still get it via E2E_SLOW=1; the slowest passing test in
  // the suite is ~10s.
  testTimeout: process.env.E2E_SLOW === '1' ? 300000 : 60000,

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

  // Stop at the first failing suite locally: the first failure is the one to
  // debug, and the ones after it are usually the same cause again or fallout
  // from the state the first left behind. Nightlies want the whole picture.
  bail: process.env.CI || process.env.E2E_SLOW === '1' ? false : 1,

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
