import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Telemetry } from '#services/telemetry';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { useStore } from '#store/index';
import { handleTokenRefreshOnResume } from '#store/slices/authSlice';

/**
 * Single AppState listener for the app:
 *   - background → active: refresh token if expired, then replay offline queue
 *   - active → background: flush telemetry
 * Tracks the previous state in a closure so the resume branch only fires
 * on a real background→active transition (not on launch, where currentState
 * is already 'active').
 */
export function useAppStateLifecycle(): void {
  useEffect(() => {
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
  }, []);
}
