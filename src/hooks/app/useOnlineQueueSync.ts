import { useEffect } from 'react';
import { useAppStore, useIsOnline, useUserId } from '#store/useAppStore';
import { useStore } from '#store';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { apiReachabilityBreaker } from '#/apollo/links/apiReachabilityBreaker';
import { resumeWebSocketAfterOnline } from '#/apollo/links/wsLink';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';

/**
 * Drives the offline mutation queue from network status: coming online kicks a
 * deferred token refresh and replays; going offline pauses the queue.
 */
export function useOnlineQueueSync(): void {
  const isOnline = useIsOnline();
  // Keyed on BOTH halves of auth readiness, not just connectivity: `isOnline`
  // defaults true and never changes on an online launch, so without these the
  // effect runs once — before credentials exist — and offline writes sit
  // unreplayed across restarts. `user` restores from MMKV synchronously while
  // `accessToken` comes from the keychain asynchronously, so they land at
  // different times. A boolean, so a token ROTATION does not re-run this.
  const userId = useUserId();
  const hasAccessToken = useAppStore(state => !!state.accessToken);

  // The permanent-failure handler is registered by `useStartupInit`, not here —
  // `setFailureHandler` is last-write-wins and one owner is the whole point.

  useEffect(() => {
    if (!isOnline) {
      // Unknown, not unreachable, and start probing — a `/health` success is
      // the only evidence that NetInfo is wrong. Deliberately NOT `reset()`:
      // that ends in `setApiReachable(true)`, overwriting the store's `null` and
      // disabling offline behaviour for the whole outage.
      apiReachabilityBreaker.onDeviceOffline();
      queueManager.onOffline();
      return;
    }

    // Back online: clear any stale open circuit so the reconnect starts
    // optimistic, instead of serving cache until the next probe fires.
    apiReachabilityBreaker.reset();

    // Resume a WebSocket reconnect cycle deferred while offline (wsLink stops
    // dialing when NetInfo says the device has no connectivity).
    resumeWebSocketAfterOnline();

    // Kick a deferred refresh but NEVER gate the drain on it: that promise can
    // stay pending forever (`proactiveTokenRefresh` shares one in-flight promise
    // and `performTokenRefresh` has no timeout over its retry loop), stranding
    // the queue silently. Replaying with a stale token costs one retry, since
    // the replay path refreshes and retries on an auth error.
    const state = useStore.getState();
    if (state.needsTokenRefresh && state.refreshToken) {
      proactiveTokenRefresh()
        .then(newToken => {
          if (newToken) {
            useStore.getState().setNeedsTokenRefresh(false);
          }
        })
        .catch(() => {
          // Best effort — the replay's own auth handling is the safety net.
        });
    }

    queueManager.onOnline();
  }, [isOnline, userId, hasAccessToken]);
}
