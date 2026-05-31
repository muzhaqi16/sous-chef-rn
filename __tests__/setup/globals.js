// ---------------------------------------------------------------------------
// React Native Testing Library async settling timeout
// ---------------------------------------------------------------------------
// RNTL's default `asyncUtilTimeout` for `waitFor`/`findBy*` is 1000ms. Under a
// fully-saturated parallel run (hundreds of suites across workers), a single
// MockLink microtask resolution can take longer than 1s of wall-clock simply
// from CPU contention — making `waitFor(() => expect(loading).toBe(false))`
// spuriously time out with `loading` still `true`. Raising the ceiling well
// below the 30s `testTimeout` removes that load-induced flakiness without
// hiding genuinely stuck async work.
require('@testing-library/react-native').configure({ asyncUtilTimeout: 5000 });

// ---------------------------------------------------------------------------
// React Native globals not available in Jest
// ---------------------------------------------------------------------------
globalThis.requestIdleCallback = cb =>
  setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
globalThis.cancelIdleCallback = id => clearTimeout(id);

// crypto.getRandomValues — RN uses react-native-get-random-values (see index.js).
// In Jest we stand in Node's webcrypto so uuid v4 works in unit tests.
if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = require('crypto').webcrypto;
}

// ---------------------------------------------------------------------------
// Suppress all console output in tests by default.
// Tests can assert on calls via expect(console.error).toHaveBeenCalledWith(...)
// To debug, temporarily comment out the relevant line below.
//
// Exception: Apollo cache "Missing field" warnings indicate an optimistic
// response (or any cache write) is missing a non-nullable field selected by
// the operation. These almost always point at a real bug — fail the test
// instead of silently swallowing.
// ---------------------------------------------------------------------------
const APOLLO_MISSING_FIELD = /Missing field '[^']+' while writing result/;

// Silence module-import-time console output too. The `beforeEach` spies below
// only cover code that runs inside a test; logs emitted while a test file's
// top-level imports evaluate (e.g. the persisted zustand store's
// `onRehydrateStorage` error log in src/store/index.ts, which fires the moment
// `useStore` is created) happen before any `beforeEach`, so without this they
// leak to the console. setupFilesAfterEach runs before the test module loads,
// so installing the no-ops here covers that window.
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    const first = args[0];
    if (typeof first === 'string' && APOLLO_MISSING_FIELD.test(first)) {
      throw new Error(`Apollo cache write error: ${first}`);
    }
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
