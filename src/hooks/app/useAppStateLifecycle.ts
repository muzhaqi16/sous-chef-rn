import { useEffect } from 'react';
import { requirePlatform } from '#platform/install';
import type { AppLifecycleState } from '#platform/ports';
import { Telemetry } from '#services/telemetry';
import { apiReachabilityBreaker } from '#/apollo/links/apiReachabilityBreaker';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { flushCachePersistence } from '#/apollo/client';
import { useStore } from '#store';
import { useIsHydrated } from '#store/useAppStore';
import { handleTokenRefreshOnResume } from '#store/slices/authSlice';
import { logger } from '#/utils/environment';

/**
 * Session and persistence work on app lifecycle changes; the resync's own listener
 * lives in `src/apollo/refetchEvents.ts`. The previous state is tracked in a closure so
 * the resume branch fires only on a real background → active transition, not on
 * launch. Gated on `isHydrated`: an earlier `active` event reaches
 * `Telemetry.trackEvent()` before MMKV is up and crashes telemetry init.
 */
export function useAppStateLifecycle(): void {
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated) return;

    const lifecycle = requirePlatform('appLifecycle');
    let lastAppState = lifecycle.current();

    const handleAppStateChange = async (nextAppState: AppLifecycleState) => {
      Telemetry.trackEvent('app_state_change', { state: nextAppState });
      const wasBackgrounded =
        lastAppState === 'inactive' || lastAppState === 'background';
      lastAppState = nextAppState;

      if (nextAppState === 'active') {
        if (wasBackgrounded) {
          // Probe, don't assume: the open-circuit backoff timer did not run
          // while the JS thread was suspended.
          apiReachabilityBreaker.onAppForeground();
          await handleTokenRefreshOnResume(
            () => useStore.getState().accessToken,
          );
        }
        queueManager.processQueue().catch(error => {
          logger.error('Failed to process queue on resume:', error);
        });
      } else if (nextAppState === 'background') {
        // Persist recent cache writes before a possible kill, so local-first
        // state paints from disk on cold start.
        flushCachePersistence();
        // Transport failures are caught and re-buffered inside the flush.
        void Telemetry.flush();
      }
    };

    return lifecycle.subscribe(nextAppState => {
      void handleAppStateChange(nextAppState);
    });
  }, [isHydrated]);
}
