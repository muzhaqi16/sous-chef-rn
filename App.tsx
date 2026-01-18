import React, { useEffect, useRef } from 'react';
import { AppState, StatusBar } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { enableScreens } from 'react-native-screens';
import { useAppStore, selectHydrated } from '#store/useAppStore';
import { useStore } from '#store/index';
import { client } from '#/apollo/client';
import { Navigation } from '#navigation';
import { hasCredentials } from '#storage/keychain';
import { SplashScreen } from '#screens/SplashScreen';
import { ToastProvider } from '#components/atoms/Toast';
import { StatusBarBackground } from '#components/atoms/StatusBarBackground';
import { useTheme } from '#hooks/useTheme';
import { Telemetry } from '#services/telemetry';
import { MemoryMonitor } from '#services/performance';
import { AppErrorBoundary } from '#components/providers/ErrorBoundary';
import { useNetworkStatus } from '#hooks/useNetworkStatus';
import { queueManager } from '#/apollo/offlineQueue';
import { NotificationProvider } from '#/components/notifications/NotificationProvider';
import { DataProvider } from '#/components/providers/DataProvider';
import { SubscriptionProvider } from '#/components/providers/SubscriptionProvider';
import {
  initAppStateTokenRefresh,
  cleanupAppStateTokenRefresh,
} from '#store/slices/authSlice';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initializeDeviceId } from '#/utils/deviceId';

// Enable native screens for better performance
enableScreens();

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

      // Initialize device ID early - needed for WebSocket subscription self-echo filtering
      initializeDeviceId();

      // Check for stored credentials
      hasCredentials().then(result => {
        setHasStoredCredentials(result);
      });

      // Initialize telemetry service
      Telemetry.updateConfig(getTelemetryConfig());
      Telemetry.initialize();

      // Track app start as counter metric for dashboard
      Telemetry.increment('app_starts_total');

      // Track app launch event (captures theme at launch time)
      Telemetry.trackEvent('app_launched', {
        theme,
        timestamp: new Date().toISOString(),
      });

      // Start memory monitoring (only in dev or if enabled in settings)
      if (__DEV__) {
        MemoryMonitor.start(10000); // Sample every 10 seconds
      }

      // Initialize AppState token refresh to handle background resume
      // This ensures tokens are refreshed before queries fire when app resumes
      initAppStateTokenRefresh(() => useStore.getState().accessToken);
    }

    return () => {
      // Cleanup memory monitor on unmount
      if (__DEV__) {
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

      if (nextAppState === 'background') {
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
                <StatusBar
                  barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                />
                <StatusBarBackground />
                <SafeAreaView style={styles.container}>
                  <ToastProvider>
                    <NotificationProvider>
                      <BottomSheetModalProvider>
                        <Navigation />
                      </BottomSheetModalProvider>
                    </NotificationProvider>
                  </ToastProvider>
                </SafeAreaView>
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
