/**
 * Global type declarations for React Native APIs not in standard TypeScript types
 */

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

/** @see https://reactnative.dev/docs/global-requestIdleCallback */
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

/** Schedules a callback for when the JS runtime is idle. */
declare function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
): number;

/** Cancels a scheduled idle callback. */
declare function cancelIdleCallback(handle: number): void;

/**
 * Global properties added for performance tracking
 */
declare namespace globalThis {
  var __APP_START_TIMESTAMP: number | undefined;
  /**
   * Installed by the New Architecture's legacy interop layer;
   * `viewManagerProbe` wraps it to time constant fetches by name.
   */
  var RN$LegacyInterop_UIManager_getConstantsForViewManager:
    | ((viewManagerName: string) => unknown)
    | undefined;
}
