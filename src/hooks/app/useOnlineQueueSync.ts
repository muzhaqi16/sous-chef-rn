import { useEffect } from 'react';
import { useIsOnline } from '#store/useAppStore';
import { useStore } from '#store';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';

/**
 * Drives the offline mutation queue from network status. When the device
 * comes online, attempts a deferred token refresh (if one was queued during
 * the offline window) before replaying queued mutations; goes offline path
 * pauses the queue.
 */
export function useOnlineQueueSync(): void {
  const isOnline = useIsOnline();

  useEffect(() => {
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
