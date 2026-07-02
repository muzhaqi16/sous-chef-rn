import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ApolloProvider } from '@apollo/client/react';
import { useIsHydrated } from '#store/useAppStore';
import { client } from '#/apollo/client';
import { Navigation } from '#navigation/RootNavigator';
import { SplashScreen } from '#screens/SplashScreen';
import { ToastProvider } from '#components/atoms/Toast';
import { OfflineTransitionToaster } from '#components/atoms/OfflineTransitionToaster';
import { ThemedStatusBar } from '#components/atoms/ThemedStatusBar';
import { AppErrorBoundary } from '#components/providers/ErrorBoundary';
import { useAppLifecycle } from '#hooks/app/useAppLifecycle';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import type { FailedMutationInfo } from '#/apollo/offlineQueue/types';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n/t';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { NotificationProvider } from '#features/notifications/components/NotificationProvider';
import { AlertProvider } from '#/components/providers/AlertProvider';
import { DataProvider } from '#/components/providers/DataProvider';
import { SubscriptionProvider } from '#/components/providers/SubscriptionProvider';
import { OverlayBackdropProvider, GlobalBackdrop } from '#/components/providers/OverlayBackdropProvider';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { setupGlobalErrorHandler } from '#/utils/globalErrorHandler';
import { setPushTokenProvider } from '#/services/push/pushTokenProvider';
import { nativePushProvider } from '#/services/push/nativePushProvider';

// Install global JS exception and promise rejection handlers before any component renders
setupGlobalErrorHandler();

// Install the native push-token provider (FCM on Android, APNs on iOS once set
// up). Defensive — degrades to no token if the native module isn't present.
setPushTokenProvider(nativePushProvider);

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
    toastService.error(t('errors.queuedChangeSyncFailed'));

    // 4. Remove permanently failed mutation from queue
    queueStore.removeMutation(mutationId);
  } catch (error) {
    console.error('Failed to handle mutation failure cleanup:', error);
  }
}

// Register the failure handler on the singleton queue manager
queueManager.setFailureHandler(handleFailedMutation);

const App = () => {
  const isHydrated = useIsHydrated();
  useAppLifecycle();

  // Cache is fully restored synchronously during initializeClient() in client.ts
  // (both critical and deferred partitions merged into one cache.restore() call).
  // No deferred restore needed here.

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
