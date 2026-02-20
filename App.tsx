import React, { useEffect, useRef } from 'react';
import { AppState, StatusBar } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { useAppStore, selectHydrated } from '#store/useAppStore';
import { useStore } from '#store/index';
import { client } from '#/apollo/client';
import { Navigation } from '#navigation/RootNavigator';
import { hasCredentials } from '#storage/keychain';
import { SplashScreen } from '#screens/SplashScreen';
import { ToastProvider } from '#components/atoms/Toast';
import { StatusBarBackground } from '#components/atoms/StatusBarBackground';
import { OfflineBanner } from '#components/atoms/OfflineBanner';
import { useTheme } from '#hooks/useTheme';
import { Telemetry } from '#services/telemetry';
import { MemoryMonitor } from '#/services/performance/MemoryMonitor';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import { AppErrorBoundary } from '#components/providers/ErrorBoundary';
import { useNetworkStatus } from '#hooks/useNetworkStatus';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { NotificationProvider } from '#/components/notifications/NotificationProvider';
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

// Enable native screens for better performance
enableScreens();
// Freeze inactive stack screens to suspend their React subtrees
enableFreeze();

const App = () => {
  const isHydrated = useAppStore(selectHydrated);
  const isOnline = useAppStore(state => state.isOnline);
  const setHasStoredCredentials = useAppStore(
    state => state.setHasStoredCredentials,
  );
  const getTelemetryConfig = useAppStore(state => state.getTelemetryConfig);
  const { theme } = useTheme();

  // PERFORMANCE: Track if hydration init has run to prevent restarting on theme changes
  const hydrationInitializedRef = useRef(false);
  // Track if Detox requested background services to be disabled
  const detoxBackgroundServicesDisabledRef = useRef(false);

  // Initialize network monitoring
  useNetworkStatus();

  // Handle network status changes - trigger queue processing when online
  useEffect(() => {
    if (isOnline) {
      queueManager.onOnline();
    } else {
      queueManager.onOffline();
    }
  }, [isOnline]);

  // PERFORMANCE: One-time hydration init - run only once after hydration completes
  // This prevents restarting heavy services (telemetry, keychain, memory monitor) on theme changes
  useEffect(() => {
    if (isHydrated && !hydrationInitializedRef.current) {
      hydrationInitializedRef.current = true;

      // DEV-ONLY: Inject auth tokens from Detox launchArgs to bypass login UI
      if (__DEV__) {
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

      // Initialize device ID early - needed for WebSocket subscription self-echo filtering
      initializeDeviceId();

      // Check for stored credentials
      hasCredentials().then(result => {
        setHasStoredCredentials(result);
      });

      // Initialize telemetry service
      const telemetryConfig = getTelemetryConfig();
      if (detoxBackgroundServicesDisabledRef.current) {
        // Disable flush timers that create setInterval background tasks
        telemetryConfig.enableLogs = false;
        telemetryConfig.enableMetrics = false;
      }
      Telemetry.updateConfig(telemetryConfig);
      Telemetry.initialize();

      // Report JS startup duration (time from index.js entry to store hydration)
      if (global.__APP_START_TIMESTAMP) {
        const startupDuration = Date.now() - global.__APP_START_TIMESTAMP;
        Telemetry.histogram('app_startup_duration_ms', startupDuration, {
          type: 'js_to_hydrated',
        });
        global.__APP_START_TIMESTAMP = undefined; // Prevent re-reporting on HMR
      }

      // Initialize native performance metrics (startup marks, bundle load times)
      NativePerformanceService.initialize();

      // Track app start as counter metric for dashboard
      Telemetry.increment('app_starts_total');

      // Track app launch event (captures theme at launch time)
      Telemetry.trackEvent('app_launched', {
        theme,
        timestamp: new Date().toISOString(),
      });

      // Start memory monitoring (only in dev, skip when Detox disables background services)
      if (__DEV__ && !detoxBackgroundServicesDisabledRef.current) {
        MemoryMonitor.start(10000); // Sample every 10 seconds
      }

      // Initialize AppState token refresh to handle background resume
      // This ensures tokens are refreshed before queries fire when app resumes
      initAppStateTokenRefresh(() => useStore.getState().accessToken);
    }

    return () => {
      // Cleanup memory monitor on unmount
      if (__DEV__ && !detoxBackgroundServicesDisabledRef.current) {
        MemoryMonitor.stop();
      }
      // Cleanup AppState token refresh listener
      cleanupAppStateTokenRefresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // Track theme changes separately
  const prevThemeRef = useRef(theme);
  useEffect(() => {
    if (isHydrated && prevThemeRef.current !== theme) {
      Telemetry.trackEvent('theme_changed', {
        from: prevThemeRef.current,
        to: theme,
      });
      prevThemeRef.current = theme;
    }
  }, [theme, isHydrated]);

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
      <GestureHandlerRootView style={styles.container}>
        <KeyboardProvider>
          <ApolloProvider client={client}>
          <DataProvider>
            <SubscriptionProvider>
              <SafeAreaProvider>
                <OverlayBackdropProvider>
                  <StatusBar
                    barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                  />
                  <BottomSheetModalProvider>
                    {/* Render order matters for stacking (no zIndex used):
                        1. StatusBarBackground - at the back
                        2. SafeAreaView with content
                        3. GlobalBackdrop - covers everything including status bar
                        4. BottomSheetModal portals (including ActionTray) render on top via @gorhom/bottom-sheet */}
                    <StatusBarBackground />
                    <SafeAreaView style={styles.container}>
                      <OfflineBanner />
                      <ToastProvider>
                        <NotificationProvider>
                          <Navigation />
                        </NotificationProvider>
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

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));

export default App;
