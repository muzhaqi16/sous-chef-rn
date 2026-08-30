import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Telemetry } from '#services/telemetry';
import { apiReachabilityBreaker } from '#/apollo/links/apiReachabilityBreaker';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { flushCachePersistence } from '#/apollo/client';
import { useStore } from '#store';
import { useIsHydrated } from '#store/useAppStore';
import { handleTokenRefreshOnResume } from '#store/slices/authSlice';

/**
 * The app's one AppState listener. The previous state is tracked in a closure so
 * the resume branch fires only on a real background → active transition, not on
 * launch. Gated on `isHydrated`: an earlier `active` event reaches
 * `Telemetry.trackEvent()` before MMKV is up and crashes telemetry init.
 */
export function useAppStateLifecycle(): void {
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated) return;

    let lastAppState: AppStateStatus = AppState.currentState;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      Telemetry.trackEvent('app_state_change', { state: nextAppState });
      const wasBackgrounded = /inactive|background/.test(lastAppState);
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
        queueManager.processQueue();
      } else if (nextAppState === 'background') {
        // Persist recent cache writes before a possible kill, so local-first
        // state paints from disk on cold start.
        flushCachePersistence();
        Telemetry.flush();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, [isHydrated]);
}
