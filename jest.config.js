const { jestModuleNameMapper } = require('./scripts/lib/aliases');

module.exports = {
  preset: '@react-native/jest-preset',
  testTimeout: 30000,
  forceExit: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    // Binary assets (fonts, images, etc.)
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg)$':
      '<rootDir>/__tests__/__mocks__/fileMock.js',
    // Native module that needs to be mocked before anything imports unistyles
    'react-native-nitro-modules':
      '<rootDir>/__tests__/__mocks__/react-native-nitro-modules.js',
    // MLKit text recognition — stubbed in tests to avoid loading native bindings
    '^@react-native-ml-kit/text-recognition$':
      '<rootDir>/__tests__/__mocks__/react-native-ml-kit-text-recognition.js',
    // Path aliases, derived from tsconfig.json — see scripts/lib/aliases.js.
    // Spread last so the explicit mocks above still win where they overlap.
    ...jestModuleNameMapper(),
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/__tests__/helpers/',
    '/__tests__/__mocks__/',
    '/__tests__/setup/',
    // Sub-agents work in `.claude/worktrees/<id>/` (git worktrees from HEAD).
    // Without this, the host's `npm test` would walk into every worktree and
    // run a duplicated copy of the suite per agent in flight.
    '/\\.claude/worktrees/',
  ],
  modulePathIgnorePatterns: ['/\\.claude/worktrees/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/graphql/generated/**',
    '!src/**/*.generated.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  // Thresholds are set ~1pp below current actual coverage so they lock in
  // existing test coverage and catch regressions, without forcing an immediate
  // wave of test writing. Bump these as coverage rises.
  coverageThreshold: {
    global: {
      branches: 54,
      functions: 52,
      lines: 72,
      statements: 72,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-native|' +
      'react-native|' +
      'react-native-unistyles|' +
      'react-native-reanimated|' +
      'react-native-gesture-handler|' +
      'react-native-safe-area-context|' +
      'react-native-screens|' +
      'react-native-svg|' +
      '@gorhom/bottom-sheet|' +
      'react-native-draggable-flatlist|' +
      'react-native-permissions|' +
      'react-native-vision-camera|' +
      'react-native-vision-camera-barcode-scanner|' +
      'react-native-image-picker|' +
      'react-native-keychain|' +
      'react-native-mmkv|' +
      'react-native-device-info|' +
      'react-native-config|' +
      '@react-native-clipboard/clipboard|' +
      '@react-native-community|' +
      '@react-navigation|' +
      // react-navigation 8 @next pulls these in as ESM-only ("type":"module")
      // deps — Jest must transform them or they throw "Unexpected token 'export'".
      'nanoid|' +
      'escape-string-regexp|' +
      'query-string|' +
      'decode-uri-component|' +
      'split-on-first|' +
      'filter-obj|' +
      'standard-navigation|' +
      '@notifee/react-native|' +
      'immer|' +
      'zustand|' +
      'uuid|' +
      'react-native-launch-arguments|' +
      'react-native-performance|' +
      'react-native-haptic-feedback|' +
      'fractional-indexing|' +
      '@paralleldrive/cuid2|' +
      '@noble/hashes|' +
      'error-causes' +
      ')/)',
  ],
};
