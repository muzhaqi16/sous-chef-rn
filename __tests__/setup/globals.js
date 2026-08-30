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

// Collected during the test, reported in `afterEach`. Throwing from inside the
// `console.error` spy instead would abort Apollo's write mid-flight: the
// mutation never settles, and the test fails as a 5s `waitFor` timeout naming
// the wrong thing. Collecting keeps Apollo's control flow intact so the test
// fails on the real reason.
const apolloCacheWriteErrors = [];

beforeEach(() => {
  apolloCacheWriteErrors.length = 0;
  globalThis.__apolloPartialMocksInUse = false;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    const first = args[0];
    if (typeof first === 'string' && APOLLO_MISSING_FIELD.test(first)) {
      // An EMPTY result is not an incomplete entity — it is no data at all,
      // which is what a local-first write gets when `queueLink` resolves the
      // queued mutation with a null result. The cache was already written
      // permanently before the mutation fired, so nothing is missing; flagging
      // it would make the offline path unreportable.
      const formatted = require('node:util').format(...args);
      if (/while writing result \{\}\s*$/.test(formatted)) {
        return;
      }
      // `writePurchaseInfo` writes the WHOLE purchase-record fragment while
      // supplying only the fields the cache actually holds — deliberately, so
      // it never invents a value the record's merge policy would then clear
      // (see `carriedForward` in apollo/utils/shoppingListCacheUpdaters.ts).
      // `ShoppingListItemDisplayFragment` caches two of the eight fields on
      // purpose, so this writer reports missing fields in production too. It is
      // a documented design, not an incomplete mock.
      if (/ShoppingListItemPurchaseInfo/.test(formatted)) {
        return;
      }
      // Apollo hands the template and its substitutions separately —
      // `console.error("Missing field '%s' while writing result %o", name, obj)`
      // — so the raw `args[0]` names neither the field nor the payload.
      apolloCacheWriteErrors.push(require('node:util').format(...args));
    }
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  if (apolloCacheWriteErrors.length === 0) return;
  // The test asked for partial data (see `partial` / `partialMocks` in
  // `apolloMockProvider`), so an incomplete write is the subject, not a defect.
  if (globalThis.__apolloPartialMocksInUse) {
    apolloCacheWriteErrors.length = 0;
    return;
  }
  const seen = [...new Set(apolloCacheWriteErrors)];
  apolloCacheWriteErrors.length = 0;
  throw new Error(
    'Apollo cache write error — a mock is missing a field its operation ' +
      'selects. The whole cache read goes incomplete, so this hides real ' +
      'behaviour rather than just adding noise. Add the field to the mock:\n\n' +
      seen.map(m => `  - ${m}`).join('\n'),
  );
});
