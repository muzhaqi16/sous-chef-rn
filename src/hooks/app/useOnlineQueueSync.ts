import { useEffect } from 'react';
import { useIsOnline } from '#store/useAppStore';
import { useStore } from '#store';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';
import { toastService } from '#/services/toastService';
import { logger } from '#/utils/environment';

/**
 * Drives the offline mutation queue from network status. When the device
 * comes online, attempts a deferred token refresh (if one was queued during
 * the offline window) before replaying queued mutations; goes offline path
 * pauses the queue.
 */
export function useOnlineQueueSync(): void {
  const isOnline = useIsOnline();

  // Surface permanently-failed queued mutations (a real, non-retryable
  // server/validation error on replay — network errors stay PENDING and are
  // never marked failed) so a change can't diverge from the server silently.
  // Registered once; `pull to refresh` lets the user resync the authoritative
  // server state. (Automatic per-entity revert is a future enhancement.)
  useEffect(() => {
    queueManager.setFailureHandler(info => {
      logger.warn('Queue: permanent sync failure', info);
      toastService.error("Couldn't sync a change — pull to refresh to update.");
    });
  }, []);

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
