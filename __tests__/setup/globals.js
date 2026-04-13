// ---------------------------------------------------------------------------
// React Native globals not available in Jest
// ---------------------------------------------------------------------------
globalThis.requestIdleCallback = cb =>
  setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
globalThis.cancelIdleCallback = id => clearTimeout(id);

// ---------------------------------------------------------------------------
// Suppress all console output in tests by default.
// Tests can assert on calls via expect(console.error).toHaveBeenCalledWith(...)
// To debug, temporarily comment out the relevant line below.
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
