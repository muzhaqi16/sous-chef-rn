module.exports = {
  preset: 'react-native',
  testTimeout: 30000,
  forceExit: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    // Binary assets (fonts, images, etc.)
    '\\.(ttf|otf|png|jpg|jpeg|gif|webp|svg)$':
      '<rootDir>/src/test-utils/__mocks__/fileMock.js',
    // Native module that needs to be mocked before anything imports unistyles
    'react-native-nitro-modules':
      '<rootDir>/src/test-utils/__mocks__/react-native-nitro-modules.js',
    // Path aliases matching tsconfig.json / babel module-resolver
    '^#/(.*)$': '<rootDir>/src/$1',
    '^#assets(.*)$': '<rootDir>/src/assets$1',
    '^#components(.*)$': '<rootDir>/src/components$1',
    '^#constants(.*)$': '<rootDir>/src/constants$1',
    '^#config(.*)$': '<rootDir>/src/config$1',
    '^#context(.*)$': '<rootDir>/src/context$1',
    '^#generated(.*)$': '<rootDir>/src/graphql/generated$1',
    '^#graphql(.*)$': '<rootDir>/src/graphql$1',
    '^#hooks(.*)$': '<rootDir>/src/hooks$1',
    '^#navigation(.*)$': '<rootDir>/src/navigation$1',
    '^#screens(.*)$': '<rootDir>/src/screens$1',
    '^#services(.*)$': '<rootDir>/src/services$1',
    '^#storage(.*)$': '<rootDir>/src/storage$1',
    '^#store(.*)$': '<rootDir>/src/store$1',
    '^#styles(.*)$': '<rootDir>/src/styles$1',
    '^#types(.*)$': '<rootDir>/src/types$1',
    '^#utils(.*)$': '<rootDir>/src/utils$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/graphql/generated/**',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
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
      'react-native-image-picker|' +
      'react-native-keychain|' +
      'react-native-mmkv|' +
      'react-native-get-random-values|' +
      'react-native-device-info|' +
      'react-native-config|' +
      '@react-native-clipboard/clipboard|' +
      '@react-native-community|' +
      '@react-navigation|' +
      '@notifee/react-native|' +
      'immer|' +
      'zustand|' +
      'uuid|' +
      'react-native-launch-arguments' +
      ')/)',
  ],
};
