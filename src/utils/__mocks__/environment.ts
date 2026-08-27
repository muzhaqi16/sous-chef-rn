/**
 * Shared test mock for `Environment`.
 *
 * Applied globally via `jest.setup.js` (`jest.mock('#/utils/environment')`),
 * so any test that transitively pulls in `Environment` — through the store,
 * `telemetrySlice`, `IconButton → HapticService`, or anywhere else — gets a
 * complete `jest.fn()` surface with sensible defaults instead of crashing
 * with `TypeError: Environment.X is not a function`.
 *
 * Conventions for tests that touch `Environment`:
 *
 *   ✅ DO — override individual return values per-suite:
 *     ```ts
 *     import { Environment } from '#/utils/environment';
 *     beforeEach(() => {
 *       (Environment.isDevelopment as jest.Mock).mockReturnValue(false);
 *     });
 *     ```
 *
 *   ✅ DO — opt out entirely when testing the real Environment class:
 *     ```ts
 *     jest.unmock('#/utils/environment');
 *     import { Environment } from '../environment';
 *     ```
 *
 *   ❌ DON'T — provide a per-suite factory like
 *     `jest.mock('#/utils/environment', () => ({ Environment: {...partial...} }))`.
 *     Partial factories REPLACE this shared mock and re-introduce the
 *     "missing method" fragility the shared mock exists to prevent.
 *
 * Defaults below assume a "test environment in dev mode" so that code paths
 * gated on `isDevelopment()` (debug logs, dev-only UI) are exercised, while
 * production-only paths (analytics, crash reporting) stay off.
 */

const config = {
  isDevelopment: true,
  isProduction: false,
  isStaging: false,
  isTesting: true,
  platform: 'ios',
  buildMode: 'debug',
};

const apiConfig = {
  baseUrl: 'http://localhost:4000/graphql',
  wsUrl: 'ws://localhost:4000/graphql',
  timeout: 10000,
  retries: 3,
};

export const Environment = {
  getConfig: jest.fn(() => config),
  isDevelopment: jest.fn(() => true),
  isProduction: jest.fn(() => false),
  isStaging: jest.fn(() => false),
  isTesting: jest.fn(() => true),
  // Default ON, matching what the REAL function returns under Jest. The real
  // gate is `__DEV__ || env.ALLOW_LAUNCH_ARG_AUTH === 'true'`, and
  // `@react-native/jest-preset` defines `__DEV__` as true, so every test
  // environment takes the first branch.
  //
  // This used to default to `false` with a comment claiming it matched — the
  // opposite of the truth, and `Environment` is auto-mocked globally, so any
  // suite rendering `useStartupInit` without an explicit override never entered
  // `injectDetoxLaunchArgs` at all. A regression inside it — a renamed launch
  // arg, a parse change, a throw — passed CI untouched. That is the class of
  // failure that produced commit deaf9d4c. A suite that wants the capability
  // OFF now says so explicitly, which is the state the old comment described.
  allowsLaunchArgAuth: jest.fn(() => true),
  getPlatform: jest.fn(() => 'ios' as 'ios' | 'android' | 'web'),
  shouldEnableDebugFeatures: jest.fn(() => true),
  shouldEnableCrashReporting: jest.fn(() => false),
  shouldEnableAnalytics: jest.fn(() => false),
  getLogLevel: jest.fn(
    () => 'none' as 'debug' | 'info' | 'warn' | 'error' | 'none',
  ),
  getApiConfig: jest.fn(() => apiConfig),
  clearCache: jest.fn(),
};

export const getWebAppUrl = jest.fn(
  (path: string = '') => `https://souschef.dev${path}`,
);

export const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  production: jest.fn(),
};

export type EnvironmentConfig = typeof config;
