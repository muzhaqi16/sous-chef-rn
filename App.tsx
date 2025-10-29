import React, { useEffect } from 'react';
import { StatusBar, AppState, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { enableScreens } from 'react-native-screens';
import { useStore } from '#store';
import { client } from './src/apollo/client';
import { Navigation } from '#/navigation';
import { hasCredentials } from '#storage/keychain';
import { SplashScreen } from '#screens';
import { ToastProvider } from '#/components/atoms';
import { useTheme } from '#/hooks/useTheme';
import { Telemetry } from '#/services/telemetry';
import { AppErrorBoundary } from '#/components/providers/ErrorBoundary';
import { useNetworkStatus } from '#/hooks/useNetworkStatus';
import { queueManager } from '#/apollo/offlineQueue';
import { NotificationProvider } from '#/components/notifications/NotificationProvider';
import { DataProvider } from '#/components/providers/DataProvider';
import { SubscriptionProvider } from '#/components/providers/SubscriptionProvider';

// Enable native screens for better performance
enableScreens();

const App = () => {
  const { isHydrated, isOnline, setHasStoredCredentials, getTelemetryConfig } =
    useStore();
  const { theme } = useTheme();
  const { theme: themeStyles } = useUnistyles();
  const isDark = theme === 'dark';

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

  useEffect(() => {
    if (isHydrated) {
      // Check for stored credentials
      hasCredentials().then(result => {
        setHasStoredCredentials(result);
      });

      // Initialize telemetry service
      Telemetry.updateConfig(getTelemetryConfig());
      Telemetry.initialize();

      // Track app launch
      Telemetry.trackEvent('app_launched', {
        theme,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isHydrated, setHasStoredCredentials, getTelemetryConfig, theme]);

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
              //  translucent on android
              {...Platform.select({
                android: {
                  translucent: true,
                  backgroundColor: themeStyles.colors.background,
                },
                ios: {},
              })}
              backgroundColor={'red'}
              hidden={false}
              animated={true}
              barStyle={isDark ? 'light-content' : 'dark-content'}
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
