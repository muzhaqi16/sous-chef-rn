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
import { client } from '#/app/apolloClient';
import { startCore } from '#bootstrap/startCore';
import { useCoreReady } from '#bootstrap/useCoreReady';
import { Navigation } from '#navigation/RootNavigator';
import { navigationRef } from '#services/NavigationService';
import { SplashScreen } from '#screens/SplashScreen';
import { ToastProvider } from '#components/molecules/Toast';
import { OfflineTransitionAnnouncer } from '#components/atoms/OfflineTransitionAnnouncer';
import { ThemedStatusBar } from '#components/atoms/ThemedStatusBar';
import { AppErrorBoundary } from '#components/providers/ErrorBoundary';
import { useAppLifecycle } from '#/app/useAppLifecycle';
import { NotificationProvider } from '#features/notifications/components/NotificationProvider';
import { AlertProvider } from '#/components/providers/AlertProvider';
import { CoreDataProvider } from '#bootstrap/CoreDataProvider';
import { FieldRendererProvider } from '#components/molecules/fieldRenderers';
import { catalogFieldRenderers } from '#features/catalog/ui/catalogFieldRenderers';
import { CoreSubscriptionProvider } from '#bootstrap/CoreSubscriptionProvider';
import {
  OverlayBackdropProvider,
  GlobalBackdrop,
} from '#/components/providers/OverlayBackdropProvider';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { setupGlobalErrorHandler } from '#/app/globalErrorHandler';
import { setPushTokenProvider } from '#/services/push/pushTokenProvider';
import { nativePushProvider } from '#/services/push/nativePushProvider';
import { iosPushProvider } from '#/services/push/iosPushProvider';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';

// Install global JS exception and promise rejection handlers before any component renders
setupGlobalErrorHandler();

// Install the native push-token provider per platform: APNs (no Firebase) on
// iOS, FCM on Android. Defensive — degrades to no token if the native module
// isn't present.
setPushTokenProvider(
  Platform.OS === 'ios' ? iosPushProvider : nativePushProvider,
);

// Device registration and the biometric slot, which a session runs on this
// device beyond the core. Before the first sign-in, which this module precedes.
registerMobileSessionHost();

// The core's start: its persisted stores and the client's resync triggers
// (`src/apollo/refetchEvents.ts`); navigation paces the language catch-up.
startCore({
  client,
  onNavigation: listener => navigationRef.addListener('state', listener),
});

const App = () => {
  // Restores the persisted cache once storage is ready, before ApolloProvider
  // below mounts and any query runs.
  const isReady = useCoreReady();
  useAppLifecycle();

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <AppErrorBoundary>
      {/* By default GestureHandlerRootView applies flex: 1, do not set style on it */}
      <GestureHandlerRootView>
        <KeyboardProvider>
          <ApolloProvider client={client}>
            {/* Which named form fields exist is an app decision, not the form
                renderer's — see `#components/molecules/fieldRenderers`. */}
            <FieldRendererProvider renderers={catalogFieldRenderers}>
              <CoreDataProvider>
                <CoreSubscriptionProvider>
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
                        2. OfflineTransitionAnnouncer - renders null; reads the
                           offline/online transition to a screen reader once.
                        3. GlobalBackdrop - covers everything including status bar
                        3b. ToastProvider - a LEAF, mounted last so the toast is
                            last in the native order; it exposes no context, so
                            nothing needs to sit inside it
                        4. BottomSheetModal portals (including ActionTray) render on top via @gorhom/bottom-sheet */}
                        <ThemedStatusBar />
                        <View style={styles.container}>
                          <AlertProvider>
                            <NotificationProvider>
                              <Navigation />
                            </NotificationProvider>
                          </AlertProvider>
                          <OfflineTransitionAnnouncer />
                        </View>
                        <GlobalBackdrop />
                        {/* Last, so the card composites above every screen's
                            header — including the ones on liquid glass. */}
                        <ToastProvider />
                      </BottomSheetModalProvider>
                    </OverlayBackdropProvider>
                  </SafeAreaProvider>
                </CoreSubscriptionProvider>
              </CoreDataProvider>
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
