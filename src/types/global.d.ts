/**
 * Global type declarations for React Native APIs not in standard TypeScript types
 */

/**
 * Options for requestIdleCallback
 * @see https://reactnative.dev/docs/global-requestIdleCallback
 */
interface IdleRequestOptions {
  /** Maximum time to wait before forcing callback execution */
  timeout?: number;
}

/**
 * Deadline object passed to idle callback
 */
interface IdleDeadline {
  /** Whether the callback is being run because the timeout expired */
  didTimeout: boolean;
  /** Returns time remaining in the current idle period */
  timeRemaining: () => number;
}

/**
 * Callback function for requestIdleCallback
 */
type IdleRequestCallback = (deadline: IdleDeadline) => void;

/**
 * Schedules a callback to run when the JavaScript runtime is idle.
 * @see https://reactnative.dev/docs/global-requestIdleCallback
 */
declare function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
): number;

/**
 * Cancels a previously scheduled idle callback.
 */
declare function cancelIdleCallback(handle: number): void;

/**
 * Global properties added for performance tracking
 */
declare namespace globalThis {
  // eslint-disable-next-line no-var
  var __APP_START_TIMESTAMP: number | undefined;
}
