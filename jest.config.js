const path = require('path');
const { jestModuleNameMapper } = require('./scripts/lib/aliases');
const { dependenciesOutsideCore } = require('./scripts/lib/layers');
const { dependencies } = require('./package.json');

// `testPathIgnorePatterns` decides what becomes a test SUITE; it does
// not reach the haste crawler. `modulePathIgnorePatterns` is the one that
// does, so the native build trees — 19GB / 67,776 files under `ios/` and
// 5.9GB / 2,701 under `android/` — are excluded here or they are walked and
// indexed into every worker's module map. No `.ts`/`.tsx` under `src/`
// resolves a module out of either directory, and neither contains a
// `package.json`, so nothing becomes unresolvable by excluding them.
const modulePathIgnorePatterns = [
  '/\\.claude/worktrees/',
  '<rootDir>/ios/',
  '<rootDir>/android/',
];

const transformIgnorePatterns = [
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
    // Ships TypeScript source as its entry (`main: src/index.ts`), and pulls
    // in an ESM-only swipe dependency.
    'react-native-calendars|' +
    'react-native-swipe-gestures|' +
    '@react-native-clipboard/clipboard|' +
    '@react-native-community|' +
    '@react-navigation|' +
    // react-navigation 8 @next pulls these in as ESM-only ("type":"module")
    // deps — Jest must transform them or they throw "Unexpected token 'export'".
    'nanoid|' +
    // The receipt rules the API shares, published as ESM only.
    '@muzhaqi16/receipt-rules|' +
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
];

/** The React Native app: every suite, under the React Native preset. */
const mobile = {
  displayName: 'mobile',
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    // Binary assets (fonts, images, etc.)
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg)$':
      '<rootDir>/__tests__/__mocks__/fileMock.js',
    // Native module that needs to be mocked before anything imports unistyles
    'react-native-nitro-modules':
      '<rootDir>/__tests__/__mocks__/react-native-nitro-modules.js',
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
    // The core-portability project's own suites.
    '/__tests__/core-portability/',
    // Specs `__tests__/lint/typedRules.test.ts` runs in one suite.
    '/__tests__/lint/typedRules/',
  ],
  modulePathIgnorePatterns,
  transformIgnorePatterns,
};

/**
 * The core with React Native out of reach: a node environment, no React Native
 * preset, React-Native-family modules that throw when loaded, and the in-memory
 * platform. Its suites load core files and run core flows.
 */
const corePortability = {
  displayName: 'core-portability',
  testEnvironment: 'node',
  // A command-line `--testMatch` (reassure's, say) replaces every project's;
  // `roots` keeps this project's search inside its own folder regardless.
  roots: ['<rootDir>/__tests__/core-portability'],
  testMatch: ['<rootDir>/__tests__/core-portability/**/*.test.ts'],
  globals: { __DEV__: true },
  // Its own transform, not the app's: the app's runs React Native's preset.
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: path.join(
          __dirname,
          '__tests__/core-portability/babel.config.js',
        ),
      },
    ],
  },
  setupFiles: ['<rootDir>/__tests__/core-portability/setup.js'],
  moduleNameMapper: {
    ...jestModuleNameMapper(),
    // `setup.js` makes each of these throw by name; a subpath of one is a
    // different specifier, which this sends to a stub that throws too.
    [`^(${dependenciesOutsideCore(dependencies)
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})/.+$`]:
      '<rootDir>/__tests__/core-portability/unloadableSubpath.js',
  },
  modulePathIgnorePatterns,
  transformIgnorePatterns,
};

module.exports = {
  testTimeout: 30000,
  forceExit: true,
  // Worker count and per-worker heap are BOTH load-bearing on a 16GB machine.
  //
  // Jest's default is `cpus - 1` (9 here), and each worker is a Node process
  // whose default V8 heap ceiling is 4288MB — ~38GB of permitted heap against
  // 16GB of RAM. V8 has no reason to collect early when the limit is that far
  // away, so every worker drifts upward until the machine swaps. A single
  // worker measured with `--logHeapUsage` sawtooths between ~200MB and ~880MB
  // across an Apollo-heavy directory; nine of those in parallel is the OOM.
  //
  // `maxWorkers` caps the multiplier and `workerIdleMemoryLimit` caps each
  // term: Jest checks a worker's heap after every test file and restarts it
  // past the limit, which turns the unbounded drift into a hard ceiling.
  // CI (`ubuntu-latest`, 4 vCPU) already ran at 3 workers and passed, which is
  // why this never showed up there — keep its count rather than halving it.
  //
  // The `test` script caps each worker's heap at 3072MB, well under V8's
  // default, and sized by the heaviest file: `hookMembersAreConsumed` type-checks
  // the whole app in one worker (~1.45GB of heap), and at 1536MB it ran out on
  // CI, where a worker carries what earlier files left under the idle limit.
  maxWorkers: process.env.CI ? '75%' : 4,
  workerIdleMemoryLimit: '512MB',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/graphql/generated/**',
    '!src/**/*.generated.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**',
    // A project excludes only its own suites from coverage, so another
    // project's tests would count as uncovered code.
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/__perf__/**',
    '!src/**/*.test.{ts,tsx}',
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
  projects: [mobile, corePortability],
};
