'use no memo';
/**
 * Jest Global Setup
 *
 * - Official library mocks are used where they work out of the box
 * - Custom mocks for packages without usable official mocks live in __tests__/setup/mocks/
 * - Simple mocks live in __mocks__/ (automatic Jest resolution for node_modules)
 * - ORDERING: react-native-nitro-modules is resolved via moduleNameMapper (jest.config.js)
 */

// ---------------------------------------------------------------------------
// Official library mocks
// ---------------------------------------------------------------------------
jest.mock('@notifee/react-native', () =>
  require('@notifee/react-native/jest-mock'),
);
jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

// ---------------------------------------------------------------------------
// Custom mocks (no usable official mock, or official mock is inadequate)
// ---------------------------------------------------------------------------
// Unistyles must be first — depends on nitro-modules (resolved via moduleNameMapper)
require('./__tests__/setup/mocks/react-native-unistyles');
require('./__tests__/setup/mocks/react-native-reanimated');
require('./__tests__/setup/mocks/react-native-gesture-handler');
require('./__tests__/setup/mocks/react-native-safe-area-context');
require('./__tests__/setup/mocks/react-navigation-native');
require('./__tests__/setup/mocks/gorhom-bottom-sheet');
require('./__tests__/setup/mocks/react-native-mmkv');
require('./__tests__/setup/mocks/react-native-device-info');
require('./__tests__/setup/mocks/react-native-keychain');
require('./__tests__/setup/mocks/react-native-keyboard-controller');
require('./__tests__/setup/mocks/react-native-haptic-feedback');
require('./__tests__/setup/mocks/react-native-performance');
require('./__tests__/setup/mocks/shopify-flash-list');
require('./__tests__/setup/mocks/shopify-react-native-skia');
require('./__tests__/setup/mocks/react-native-vision-camera');

// ---------------------------------------------------------------------------
// Globals (polyfills, console suppression)
// ---------------------------------------------------------------------------
require('./__tests__/setup/globals');

// ---------------------------------------------------------------------------
// i18n — initialize i18next so useTranslation() returns real strings in tests
// instead of raw keys. This mirrors index.js's boot-time init.
// ---------------------------------------------------------------------------
require('./src/i18n/config');

// ---------------------------------------------------------------------------
// Environment — apply the shared mock from `src/utils/__mocks__/environment.ts`
// globally. Without this, modules that read Environment at load time (e.g.
// `telemetrySlice.ts:initialTelemetryState`) crash whenever a test pulls them
// in transitively without first writing a per-suite factory mock. The shared
// mock provides safe defaults; tests that need bespoke values can still
// override via their own `jest.mock('#/utils/environment', factory)` or
// `(Environment.x as jest.Mock).mockReturnValue(...)`.
// ---------------------------------------------------------------------------
jest.mock('#/utils/environment');

// ---------------------------------------------------------------------------
// @react-native-firebase/messaging (FCM) — native module, absent under jest.
// Provide a minimal mock so anything importing the native push provider (App.tsx
// → nativePushProvider) loads. Suites that assert on push can override.
// ---------------------------------------------------------------------------
jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  requestPermission: jest.fn().mockResolvedValue(1),
  onTokenRefresh: jest.fn(() => jest.fn()),
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));
