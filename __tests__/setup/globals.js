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
