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
// Telemetry — apply the shared mock from `src/services/telemetry/__mocks__/`
// globally. The real facade reads `Environment` (auto-mocked to development
// above) and the OTLP endpoints in `env.generated.ts`, which is enough to
// enable its HTTP transport. Jest has no `fetch` mock, so any test that
// triggers an error-level log flushes immediately and ships fixture strings
// ('boom', 'Display failed', …) to the real Loki/Mimir hosts. Suites testing
// the telemetry internals import `TelemetryService` / `HttpTransport`
// directly and are unaffected.
// ---------------------------------------------------------------------------
jest.mock('#/services/telemetry');

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
  setBackgroundMessageHandler: jest.fn(),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

// ---------------------------------------------------------------------------
// Timers must never be the reason a worker cannot exit
//
// Jest force-kills a worker whose event loop is still held open when its files
// finish ("A worker process has failed to exit gracefully"), and a pending real
// timer is enough to do it. Plenty of those are legitimate: production code
// arms long safety nets — a 30s pending-delete sweep, a 10s WebSocket stability
// window — that outlive the test which triggered them, and chasing each one
// into a per-suite teardown is endless.
//
// So unref every real timer instead. An unref'd timer still fires normally
// while the worker has work to do (its IPC channel keeps the loop alive); it
// simply stops being something the process must wait on before exiting.
//
// This is a worker-exit guard, NOT a leak detector: it deliberately silences
// the warning, so it cannot tell you about a genuine runaway timer in
// production code. `npx jest --detectOpenHandles <paths>` still names them, and
// remains the tool to reach for.
//
// Assigning over the globals composes with fake timers: `jest.useFakeTimers()`
// saves whatever is installed (these wrappers) and `useRealTimers()` puts it
// back, so a suite can still swap in fake timers freely.
// ---------------------------------------------------------------------------
const unrefTimer = timer => {
  if (timer && typeof timer.unref === 'function') timer.unref();
  return timer;
};

const realSetTimeout = global.setTimeout;
const realSetInterval = global.setInterval;

global.setTimeout = (...args) => unrefTimer(realSetTimeout(...args));
global.setInterval = (...args) => unrefTimer(realSetInterval(...args));
// `promisify(setTimeout)` reads this off the function object.
global.setTimeout.__promisify__ = realSetTimeout.__promisify__;
global.setInterval.__promisify__ = realSetInterval.__promisify__;
