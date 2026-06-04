import { useEffect } from 'react';
import { useIsOnline } from '#store/useAppStore';
import { useStore } from '#store';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { apiReachabilityBreaker } from '#/apollo/links/apiReachabilityBreaker';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';

/**
 * Drives the offline mutation queue from network status. When the device
 * comes online, attempts a deferred token refresh (if one was queued during
 * the offline window) before replaying queued mutations; goes offline path
 * pauses the queue.
 */
export function useOnlineQueueSync(): void {
  const isOnline = useIsOnline();

  // The permanent-failure handler is registered once at module scope in App.tsx
  // (`handleFailedMutation` — evicts the stale entity, clears persisted optimistic
  // fields, toasts, and removes the entry from the queue). It is intentionally NOT
  // registered here: this hook mounts after App.tsx loads, so registering it here
  // would override the full handler with a lesser one.

  useEffect(() => {
    // Reset the API-reachability breaker on every connectivity transition so a
    // reconnect starts optimistic — a stale open circuit would otherwise keep
    // serving cache for up to the half-open delay after the network is back.
    apiReachabilityBreaker.reset();

    if (!isOnline) {
      queueManager.onOffline();
      return;
    }

    const state = useStore.getState();
    if (state.needsTokenRefresh && state.refreshToken) {
      proactiveTokenRefresh()
        .then(newToken => {
          if (newToken) {
            useStore.getState().setNeedsTokenRefresh(false);
          }
          queueManager.onOnline();
        })
        .catch(() => {
          queueManager.onOnline();
        });
    } else {
      queueManager.onOnline();
    }
  }, [isOnline]);
}
