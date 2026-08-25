import { useEffect } from 'react';
import { useAppStore, useIsOnline, useUserId } from '#store/useAppStore';
import { useStore } from '#store';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { apiReachabilityBreaker } from '#/apollo/links/apiReachabilityBreaker';
import { resumeWebSocketAfterOnline } from '#/apollo/links/wsLink';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';

/**
 * Drives the offline mutation queue from network status. When the device
 * comes online, attempts a deferred token refresh (if one was queued during
 * the offline window) before replaying queued mutations; goes offline path
 * pauses the queue.
 */
export function useOnlineQueueSync(): void {
  const isOnline = useIsOnline();
  // Also keyed on the authenticated user, not just connectivity. `App` calls
  // `useAppLifecycle()` BEFORE its `isHydrated` guard, so this hook mounts on
  // the first render with the store not yet hydrated: the effect below runs,
  // `processQueue` finds no authenticated user and skips. `isOnline` defaults
  // to `true` and never changes on an online launch, so the effect never ran
  // again — writes made offline then sat unreplayed through app restarts until
  // connectivity happened to flap. Re-running when the user lands closes that,
  // and also drains for whoever signs in next.
  const userId = useUserId();
  // Auth readiness is BOTH halves, and they arrive at different times.
  // `user` is in PERSISTED_KEYS, so it is restored from MMKV synchronously at
  // hydration — but `accessToken` is not: the keychain is its persistence tier
  // and `hydrateSessionTokensThenFinish` restores it asynchronously. So at the
  // first render the user is already present while the token is still null,
  // `processQueue` skips with "no authenticated user", and nothing re-triggered
  // it once the keychain resolved. Writes made offline then sat unreplayed
  // across restarts until connectivity happened to flap.
  //
  // Deferring the drain until credentials exist is correct; the bug was having
  // no trigger for when they arrive. Tracked as a boolean so a token ROTATION
  // does not pointlessly re-run this.
  const hasAccessToken = useAppStore(state => !!state.accessToken);

  // The permanent-failure handler is registered by `useStartupInit`, not here —
  // `setFailureHandler` is last-write-wins and one owner is the whole point.

  useEffect(() => {
    // Reset the API-reachability breaker on every connectivity transition so a
    // reconnect starts optimistic — a stale open circuit would otherwise keep
    // serving cache for up to the half-open delay after the network is back.
    apiReachabilityBreaker.reset();

    if (!isOnline) {
      // Unknown, not unreachable — and start probing, because a `/health`
      // success is the only evidence that can show NetInfo is wrong about a
      // link our API is reachable over anyway.
      apiReachabilityBreaker.onDeviceOffline();
      queueManager.onOffline();
      return;
    }

    // Resume a WebSocket reconnect cycle deferred while offline (wsLink stops
    // dialing when NetInfo says the device has no connectivity).
    resumeWebSocketAfterOnline();

    // Kick a deferred refresh, but do NOT gate the drain on it. This used to
    // await `proactiveTokenRefresh()` and only call `onOnline()` from its
    // `.then`/`.catch`, so an unsettled refresh stranded the queue silently:
    // writes made offline never replayed, with no error and nothing on screen.
    // That promise can stay pending — `proactiveTokenRefresh` hands every later
    // caller the existing in-flight promise, and only the ORIGINAL caller's
    // `finally` resets the state, so one stuck refresh blocks all of them, and
    // `performTokenRefresh` has no timeout over its backoff-retry loop.
    //
    // Replaying with a stale token is cheap by comparison: the replay path
    // validates the token first and refreshes + retries on an auth error, so
    // the cost is one retry rather than the whole drain.
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
