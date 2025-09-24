import React, { useEffect } from 'react';
import { StatusBar, AppState } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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

// Enable native screens for better performance
enableScreens();

const App = () => {
  const { isHydrated, setHasStoredCredentials, getTelemetryConfig } = useStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isHydrated) {
      // Check for stored credentials
      hasCredentials().then(setHasStoredCredentials);

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

    const subscription = AppState.addEventListener('change', handleAppStateChange);

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
          <SafeAreaProvider>
            <StatusBar
              barStyle={isDark ? 'light-content' : 'dark-content'}
              backgroundColor={isDark ? '#212121' : '#FAFAFA'}
            />
            <SafeAreaView style={styles.container}>
              <ToastProvider>
                <BottomSheetModalProvider>
                  <Navigation />
                </BottomSheetModalProvider>
              </ToastProvider>
            </SafeAreaView>
          </SafeAreaProvider>
        </ApolloProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  text: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    margin: 10,
  },
}));

export default App;
