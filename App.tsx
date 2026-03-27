import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { useAppStore, selectHydrated } from '#store/useAppStore';
import { useStore } from '#store/index';
import { client } from '#/apollo/client';
import { Navigation } from '#navigation/RootNavigator';
import { hasCredentials } from '#storage/keychain';
import { SplashScreen } from '#screens/SplashScreen';
import { ToastProvider } from '#components/atoms/Toast';
import { OfflineBanner } from '#components/atoms/OfflineBanner';
import { ThemedStatusBar } from '#components/atoms/ThemedStatusBar';
import { Telemetry } from '#services/telemetry';
import { HapticService } from '#services/haptic/HapticService';
import { storage } from '#/storage/mmkv';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { AppErrorBoundary } from '#components/providers/ErrorBoundary';
import { useNetworkStatus } from '#hooks/useNetworkStatus';
import { useTheme } from '#hooks/useTheme';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import type { FailedMutationInfo } from '#/apollo/offlineQueue/types';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { toastService } from '#/services/toastService';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { NotificationProvider } from '#/components/notifications/NotificationProvider';
import { AlertProvider } from '#/components/providers/AlertProvider';
import { DataProvider } from '#/components/providers/DataProvider';
import { SubscriptionProvider } from '#/components/providers/SubscriptionProvider';
import { OverlayBackdropProvider, GlobalBackdrop } from '#/components/providers/OverlayBackdropProvider';
import {
  initAppStateTokenRefresh,
  cleanupAppStateTokenRefresh,
} from '#store/slices/authSlice';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initializeDeviceId } from '#/utils/deviceId';
import { LaunchArguments } from 'react-native-launch-arguments';
import { setupGlobalErrorHandler } from '#/utils/globalErrorHandler';

// Install global JS exception and promise rejection handlers before any component renders
setupGlobalErrorHandler();

/**
 * Module-level handler for permanently failed queued mutations.
 * Evicts stale optimistic data from cache, clears persistence, shows toast, and removes from queue.
 * Defined at module scope (not inside a hook) so try-catch is safe — React Compiler doesn't apply.
 */
function handleFailedMutation(info: FailedMutationInfo): void {
  const { mutationId, entityType, entityId } = info;

  try {
    // 1. Evict stale optimistic entity from Apollo cache
    if (entityType && entityId) {
      const cacheId = client.cache.identify({ __typename: entityType, id: entityId });
      if (cacheId) {
        client.cache.evict({ id: cacheId });
        client.cache.gc();
      }
    }

    // 2. Clear persisted optimistic fields for this entity
    if (entityType && entityId) {
      optimisticDataPersistence.clearEntity(entityType, entityId);
    }

    // 3. Notify user via toast
    toastService.error("Couldn't sync changes. Pull to refresh.");

    // 4. Remove permanently failed mutation from queue
    queueStore.removeMutation(mutationId);
  } catch (error) {
    console.error('Failed to handle mutation failure cleanup:', error);
  }
}

// Register the failure handler on the singleton queue manager
queueManager.setFailureHandler(handleFailedMutation);


/** Module-level helper: Detox launch argument injection (DEV-only) */
function injectDetoxLaunchArgs(
  detoxBackgroundServicesDisabledRef: React.RefObject<boolean>,
): void {
  try {
    const args = LaunchArguments.value<{
      detoxUserToken?: string;
      detoxRefreshToken?: string;
      detoxUser?: string;
      detoxDisableBackgroundServices?: string;
    }>();
    if (args.detoxUserToken && args.detoxRefreshToken && args.detoxUser) {
      const user = JSON.parse(args.detoxUser);
      useStore
        .getState()
        .setAuth(user, args.detoxUserToken, args.detoxRefreshToken);
      console.log('[Detox] Auth injected via launchArgs');
    }
    if (args.detoxDisableBackgroundServices) {
      detoxBackgroundServicesDisabledRef.current = true;
      console.log('[Detox] Background services disabled for E2E tests');
    }
  } catch {
    // No launch args or parse error — normal app startup
  }
}

const App = () => {
  const isHydrated = useAppStore(selectHydrated);
  const isOnline = useAppStore(state => state.isOnline);
  const setHasStoredCredentials = useAppStore(
    state => state.setHasStoredCredentials,
  );
  const getTelemetryConfig = useAppStore(state => state.getTelemetryConfig);
  // PERFORMANCE: Track if hydration init has run to prevent restarting on theme changes
  const hydrationInitializedRef = useRef(false);
  // Track if Detox requested background services to be disabled
  const detoxBackgroundServicesDisabledRef = useRef(false);

  // Sync user theme preference -> UnistylesRuntime adaptive themes
  useTheme();

  // Initialize network monitoring
  useNetworkStatus();

  // Handle network status changes - trigger queue processing when online
  // When coming back online, attempt deferred token refresh before replaying queued mutations
  useEffect(() => {
    if (isOnline) {
      const state = useStore.getState();
      if (state.needsTokenRefresh && state.refreshToken) {
        proactiveTokenRefresh()
          .then(newToken => {
            if (newToken) {
              useStore.getState().setNeedsTokenRefresh(false);
            }
            // Process queue regardless — if refresh failed, queue will handle it
            queueManager.onOnline();
          })
          .catch(() => {
            // needsTokenRefresh stays true for next online transition
            queueManager.onOnline();
          });
      } else {
        queueManager.onOnline();
      }
    } else {
      queueManager.onOffline();
    }
  }, [isOnline]);

  // PERFORMANCE: One-time hydration init - run only once after hydration completes
  // This prevents restarting heavy services (telemetry, keychain, memory monitor) on theme changes
  useEffect(() => {
    // Capture ref value for use in effect body and cleanup
    const detoxDisabled = detoxBackgroundServicesDisabledRef.current;

    if (isHydrated && !hydrationInitializedRef.current) {
      hydrationInitializedRef.current = true;

      // DEV-ONLY: Inject auth tokens from Detox launchArgs to bypass login UI
      if (__DEV__) {
        injectDetoxLaunchArgs(detoxBackgroundServicesDisabledRef);
      }

      // Initialize device ID early - needed for WebSocket subscription self-echo filtering
      initializeDeviceId();

      // Check for stored credentials
      hasCredentials().then(result => {
        setHasStoredCredentials(result);
      });

      // Initialize offline mode from MMKV (transient Zustand state, not persisted via Zustand)
      useStore.getState().setOfflineModeEnabled(
        storage.getBoolean('user_offline_mode') ?? false,
      );

      // Initialize haptic feedback service (caches user preference from store)
      HapticService.initialize();

      // Initialize telemetry service
      const telemetryConfig = getTelemetryConfig();
      if (detoxDisabled) {
        // Disable flush timers that create setInterval background tasks
        telemetryConfig.enableLogs = false;
        telemetryConfig.enableMetrics = false;
      }
      Telemetry.updateConfig(telemetryConfig);
      Telemetry.initialize();

      // Initialize native performance metrics (startup marks, bundle load, HTTP timing)
      if (!detoxDisabled) {
        NativePerformanceService.initialize();
        // Auto-start memory monitoring in production so Overview dashboard
        // memory gauge populates without requiring manual opt-in
        if (!__DEV__) {
          MemoryMonitor.start();
        }
      }

      // Report JS startup duration (time from index.js entry to store hydration)
      if (global.__APP_START_TIMESTAMP) {
        const startupDuration = Date.now() - global.__APP_START_TIMESTAMP;
        Telemetry.histogram('app_startup_duration_ms', startupDuration, {
          type: 'js_to_hydrated',
        });

        // Report content appeared timing (full time from native launch to content visible)
        const contentAppearedDuration = Date.now() - global.__APP_START_TIMESTAMP;
        Telemetry.histogram('app_content_appeared_ms', contentAppearedDuration, {
          type: 'full',
        });

        global.__APP_START_TIMESTAMP = undefined; // Prevent re-reporting on HMR
      }

      // Track app launch event (captures theme at launch time)
      Telemetry.trackEvent('app_launched', {
        theme: UnistylesRuntime.themeName,
        timestamp: new Date().toISOString(),
      });

      // Initialize AppState token refresh to handle background resume
      // This ensures tokens are refreshed before queries fire when app resumes
      initAppStateTokenRefresh(() => useStore.getState().accessToken);
    }

    return () => {
      // Cleanup native performance observers and memory monitor
      if (!detoxDisabled) {
        NativePerformanceService.cleanup();
        MemoryMonitor.stop();
      }
      // Cleanup AppState token refresh listener
      cleanupAppStateTokenRefresh();
    };
  }, [isHydrated, setHasStoredCredentials, getTelemetryConfig]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      Telemetry.trackEvent('app_state_change', { state: nextAppState });

      if (nextAppState === 'active') {
        // Process any queued offline mutations when resuming from background
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

  if (!isHydrated) {
    return <SplashScreen />;
  }

  return (
    <AppErrorBoundary>
      {/* By default GestureHandlerRootView applies flex: 1, do not set style on it */}
      <GestureHandlerRootView>
        <KeyboardProvider>
          <ApolloProvider client={client}>
            <DataProvider>
              <SubscriptionProvider>
                <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                  <OverlayBackdropProvider>
                    <BottomSheetModalProvider>
                      {/* Render order matters for stacking (no zIndex used):
                        1. SafeAreaView with content (background extends under status bar via padding mode)
                        2. GlobalBackdrop - covers everything including status bar
                        3. BottomSheetModal portals (including ActionTray) render on top via @gorhom/bottom-sheet */}
                      <ThemedStatusBar />
                      <SafeAreaView mode="padding" style={styles.container} edges={['top']}>
                        <OfflineBanner />
                        <ToastProvider>
                          <AlertProvider>
                            <NotificationProvider>
                              <Navigation />
                            </NotificationProvider>
                          </AlertProvider>
                        </ToastProvider>
                      </SafeAreaView>
                      <GlobalBackdrop />
                    </BottomSheetModalProvider>
                  </OverlayBackdropProvider>
                </SafeAreaProvider>
              </SubscriptionProvider>
            </DataProvider>
          </ApolloProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
