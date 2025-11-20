import React, { useEffect, useRef } from 'react';
import { AppState, StatusBar } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { enableScreens } from 'react-native-screens';
import { useAppStore, selectHydrated } from '#store/useAppStore';
import { client } from './src/apollo/client';
import { Navigation } from '#/navigation';
import { hasCredentials } from '#storage/keychain';
import { SplashScreen } from '#screens';
import { ToastProvider } from '#/components/atoms';
import { useTheme } from '#/hooks/useTheme';
import { Telemetry } from '#/services/telemetry';
import { MemoryMonitor } from '#/services/performance';
import { AppErrorBoundary } from '#/components/providers/ErrorBoundary';
import { useNetworkStatus } from '#/hooks/useNetworkStatus';
import { queueManager } from '#/apollo/offlineQueue';
import { NotificationProvider } from '#/components/notifications/NotificationProvider';
import { DataProvider } from '#/components/providers/DataProvider';
import { SubscriptionProvider } from '#/components/providers/SubscriptionProvider';

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

      // Check for stored credentials
      hasCredentials().then(result => {
        setHasStoredCredentials(result);
      });

      // Initialize telemetry service
      Telemetry.updateConfig(getTelemetryConfig());
      Telemetry.initialize();

      // Start memory monitoring (only in dev or if enabled in settings)
      if (__DEV__) {
        MemoryMonitor.start(10000); // Sample every 10 seconds
      }
    }

    return () => {
      // Cleanup memory monitor on unmount
      if (__DEV__) {
        MemoryMonitor.stop();
      }
    };
  }, [isHydrated, setHasStoredCredentials, getTelemetryConfig]);

  // PERFORMANCE: Lightweight theme-specific tracking - separate from heavy init
  useEffect(() => {
    if (isHydrated && hydrationInitializedRef.current) {
      // Track app launch with current theme (lightweight)
      Telemetry.trackEvent('app_launched', {
        theme,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isHydrated, theme]);

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
        <ApolloProvider client={client}>
          <DataProvider>
            <SubscriptionProvider>
              <SafeAreaProvider>
                <StatusBar
                  translucent
                  backgroundColor="transparent"
                  barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                />
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
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    margin: 10,
  },
}));

export default App;
