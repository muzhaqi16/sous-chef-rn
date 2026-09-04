/**
 * The store's handle on token refresh, without importing Apollo. `authSlice`
 * schedules from SYNCHRONOUS actions so it cannot `await import()`, and a static
 * import closes `store → authSlice → apollo/links/* → store`.
 */

export interface TokenRefreshBridge {
  schedule: (accessToken: string) => void;
  cancel: () => void;
  refreshNow: () => Promise<void>;
}

let bridge: TokenRefreshBridge | null = null;
/** A schedule asked for before Apollo registered; replayed on registration. */
let pendingToken: string | null = null;

export const registerTokenRefreshBridge = (
  implementation: TokenRefreshBridge,
): void => {
  bridge = implementation;
  if (pendingToken !== null) {
    const token = pendingToken;
    pendingToken = null;
    implementation.schedule(token);
  }
};

export const scheduleProactiveRefresh = (accessToken: string): void => {
  if (bridge) {
    bridge.schedule(accessToken);
    return;
  }
  // Sign-in can land before the client module has evaluated; hold the last
  // token so the refresh is not silently skipped for the whole session.
  pendingToken = accessToken;
};

export const cancelProactiveRefresh = (): void => {
  pendingToken = null;
  bridge?.cancel();
};

/**
 * Refresh now, for the app-resume path. A no-op before Apollo registers, which
 * is also when there is no client to refresh against.
 */
export const refreshTokenNow = async (): Promise<void> => {
  await bridge?.refreshNow();
};

/** Test seam: forget the registration and any pending schedule. */
export const clearTokenRefreshBridge = (): void => {
  bridge = null;
  pendingToken = null;
};
