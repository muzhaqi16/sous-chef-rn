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
// Apollo ships its invariant messages STRIPPED: `invariant.error` receives a
// message NUMBER and, with no handler registered, logs
// "An error occurred! ... https://go.apollo.dev/c/err#<url-encoded payload>"
// instead of the English text (node_modules/@apollo/client/utilities/invariant/
// index.js — `getHandledErrorMsg` returns undefined, so `getFallbackErrorMsg`
// wins). The regex below matches the DECODED text, which never reaches the
// console on its own — so the guard silently passed everything through.
// `loadErrorMessages` + `loadDevMessages` install the handler that restores the
// real string, which is what makes the check below actually fire.
const { loadDevMessages, loadErrorMessages } = require('@apollo/client/dev');
loadDevMessages();
loadErrorMessages();

// The missing-field guard lives in its own module so that what it suppresses
// and what it still reports can be asserted on — see
// `__tests__/setup/apolloCacheWriteGuard.js` and the breadth test it names.
const {
  collectCacheWriteError,
  reportCollectedCacheWriteErrors,
} = require('./apolloCacheWriteGuard');

// Silence module-import-time console output too. The `beforeEach` spies below
// only cover code that runs inside a test; logs emitted while a test file's
// top-level imports evaluate (e.g. the persisted zustand store's
// `onRehydrateStorage` error log in src/store/index.ts, which fires the moment
// `useStore` is created) happen before any `beforeEach`, so without this they
// leak to the console. setupFilesAfterEach runs before the test module loads,
// so installing the no-ops here covers that window.
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Captured before any suite can install fake timers, so the flush below still
// yields to the macrotask queue in a suite running `jest.useFakeTimers()`.
const realSetImmediate = globalThis.setImmediate;
const settlePendingWork = () =>
  new Promise(resolve => realSetImmediate(resolve));

beforeEach(() => {
  // Filled by `apolloMockProvider` when a mock is marked `partial`: the exact
  // `Type.field` pairs that mock's payload leaves out, and nothing else.
  globalThis.__apolloPartialFieldExemptions = new Set();
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    collectCacheWriteError(args, {
      exemptions: globalThis.__apolloPartialFieldExemptions,
    });
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  // Let work already in flight finish before the guard reads. A cache write
  // that settles after the assertion point is the case the collection above
  // cannot otherwise attribute, and 32 suites `await act(async …)` with no
  // `waitFor` anywhere in the file — structurally in that position, and
  // reporting zero. The flush belongs here rather than in whichever test
  // someone noticed.
  await settlePendingWork();
  await settlePendingWork();
  reportCollectedCacheWriteErrors('afterEach');
});

afterAll(() => {
  // Anything arriving after the file's last test has no `afterEach` left to
  // read it. Without this it is simply dropped, which reads as a pass.
  reportCollectedCacheWriteErrors('afterAll');
});
