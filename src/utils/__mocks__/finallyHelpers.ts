import type * as FinallyHelpers from '../finallyHelpers';

/** The real helpers, each wrapped in `jest.fn()` so a suite can watch or override one. */
const actual = jest.requireActual<typeof FinallyHelpers>('../finallyHelpers');

export const executeRefreshWithFinally = jest.fn(
  actual.executeRefreshWithFinally,
);
export const executeWriteWithFinally = jest.fn(actual.executeWriteWithFinally);
export const executeAsyncWithCleanup = jest.fn(actual.executeAsyncWithCleanup);
export const executeWithLoadingState = jest.fn(actual.executeWithLoadingState);
