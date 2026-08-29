import React from 'react';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { useIsHydrated } from '#store/useAppStore';
import { client, restorePersistedCache } from '#/apollo/client';
import { Navigation } from '#navigation/RootNavigator';
import { SplashScreen } from '#screens/SplashScreen';
import { ToastProvider } from '#components/atoms/Toast';
import { OfflineTransitionToaster } from '#components/atoms/OfflineTransitionToaster';
import { ThemedStatusBar } from '#components/atoms/ThemedStatusBar';
import { AppErrorBoundary } from '#components/providers/ErrorBoundary';
import { useAppLifecycle } from '#hooks/app/useAppLifecycle';
import { NotificationProvider } from '#features/notifications/components/NotificationProvider';
import { AlertProvider } from '#/components/providers/AlertProvider';
import { DataProvider } from '#/app/providers/DataProvider';
import { FieldRendererProvider } from '#components/molecules/fieldRenderers';
import { catalogFieldRenderers } from '#features/catalog/ui/catalogFieldRenderers';
import { SubscriptionProvider } from '#/app/providers/SubscriptionProvider';
import {
  OverlayBackdropProvider,
  GlobalBackdrop,
} from '#/components/providers/OverlayBackdropProvider';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { setupGlobalErrorHandler } from '#/utils/globalErrorHandler';
import { setPushTokenProvider } from '#/services/push/pushTokenProvider';
import { nativePushProvider } from '#/services/push/nativePushProvider';
import { iosPushProvider } from '#/services/push/iosPushProvider';

// Install global JS exception and promise rejection handlers before any component renders
setupGlobalErrorHandler();

// Install the native push-token provider per platform: APNs (no Firebase) on
// iOS, FCM on Android. Defensive — degrades to no token if the native module
// isn't present.
setPushTokenProvider(
  Platform.OS === 'ios' ? iosPushProvider : nativePushProvider,
);

const App = () => {
  const isHydrated = useIsHydrated();
  useAppLifecycle();

  if (!isHydrated) {
    return <SplashScreen />;
  }

  // Restore the persisted Apollo cache here, not in initializeClient(): that
  // runs at module import, before the async keychain-backed storage init has
  // resolved, so it always found storage unready and restored nothing. This is
  // the first point where storage is guaranteed ready AND ApolloProvider has
  // not mounted yet — `cache.restore()` replaces cache contents wholesale, so
  // it must land before any query runs. Idempotent; safe on every render.
  restorePersistedCache();

  return (
    <AppErrorBoundary>
      {/* By default GestureHandlerRootView applies flex: 1, do not set style on it */}
      <GestureHandlerRootView>
        <KeyboardProvider>
          <ApolloProvider client={client}>
            {/* Which named form fields exist is an app decision, not the form
                renderer's — see `#components/molecules/fieldRenderers`. */}
            <FieldRendererProvider renderers={catalogFieldRenderers}>
              <DataProvider>
                <SubscriptionProvider>
                  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                    <OverlayBackdropProvider>
                      <BottomSheetModalProvider>
                        {/* Render order matters for stacking (no zIndex used):
                        1. App content. The top safe-area inset is NOT applied
                           here — it's applied per screen via `TopInsetLayout`
                           (so screens like Recipe Detail can draw their hero
                           edge-to-edge behind the status bar). The offline
                           indicator is `OfflineStatusPill`, rendered inline in
                           each screen's header — nothing global occupies the
                           top inset.
                        2. OfflineTransitionToaster - renders null; fires the
                           offline/online announcement toast once at the root.
                        3. GlobalBackdrop - covers everything including status bar
                        4. BottomSheetModal portals (including ActionTray) render on top via @gorhom/bottom-sheet */}
                        <ThemedStatusBar />
                        <View style={styles.container}>
                          <ToastProvider>
                            <AlertProvider>
                              <NotificationProvider>
                                <Navigation />
                              </NotificationProvider>
                            </AlertProvider>
                          </ToastProvider>
                          <OfflineTransitionToaster />
                        </View>
                        <GlobalBackdrop />
                      </BottomSheetModalProvider>
                    </OverlayBackdropProvider>
                  </SafeAreaProvider>
                </SubscriptionProvider>
              </DataProvider>
            </FieldRendererProvider>
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
