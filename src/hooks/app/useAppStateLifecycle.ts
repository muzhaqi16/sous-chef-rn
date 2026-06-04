import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Telemetry } from '#services/telemetry';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { flushCachePersistence } from '#/apollo/client';
import { useStore } from '#store';
import { useIsHydrated } from '#store/useAppStore';
import { handleTokenRefreshOnResume } from '#store/slices/authSlice';

/**
 * Single AppState listener for the app:
 *   - background → active: refresh token if expired, then replay offline queue
 *   - active → background: flush the pending cache write + telemetry
 * Tracks the previous state in a closure so the resume branch only fires
 * on a real background→active transition (not on launch, where currentState
 * is already 'active').
 *
 * Gated on `isHydrated` — the listener is only registered after Zustand
 * hydration completes, which guarantees MMKV storage is initialized.
 * Without this gate, an early AppState `active` event fires
 * `Telemetry.trackEvent()` before storage is ready, crashing telemetry
 * module init (getDeviceId → storage.getString).
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
          await handleTokenRefreshOnResume(
            () => useStore.getState().accessToken,
          );
        }
        queueManager.processQueue();
      } else if (nextAppState === 'background') {
        // Persist the last few seconds of cache writes before a possible kill so
        // optimistic local-first state paints from disk on cold start (no-op
        // when nothing is pending).
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
