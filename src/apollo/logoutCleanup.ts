import { client, cancelCachePersistence } from './client';
import { InMemoryCache } from '@apollo/client';
import { useStore } from '#store';
import { storage } from '#/storage/mmkv';
import { apolloCachePersistence } from './offline/ApolloCachePersistence';
import { optimisticDataPersistence } from './offline/OptimisticDataPersistence';
import { cancelTokenRefresh } from './links/tokenScheduler';
import { disposeWebSocket } from './links/wsLink';
import { registerSessionTeardown } from '#store/sessionTeardown';
import { logger } from '#/utils/environment';

interface LogoutCleanupOptions {
  clearCache?: boolean;
  cancelSubscriptions?: boolean;
  suppressErrors?: boolean;
}

/**
 * A cleanup-registerable subscription: either an RxJS-style observer with an
 * `unsubscribe` method, or a plain teardown function (e.g. a React Navigation
 * listener cleanup).
 */
type CleanupSubscription = { unsubscribe: () => void } | (() => void);

/**
 * Centralized Apollo cleanup utility for logout
 * Handles cache clearing, subscription cancellation, and error suppression
 */
export class LogoutCleanup {
  private static isLoggingOut = false;
  private static activeSubscriptions = new Set<CleanupSubscription>();

  /**
   * Check if the app is currently in logout process
   */
  static isInLogoutProcess(): boolean {
    // Check both local flag and global store state
    const globalState = useStore.getState().isLoggingOut;
    return LogoutCleanup.isLoggingOut || globalState;
  }

  /**
   * Register an active subscription for cleanup
   */
  static registerSubscription(subscription: CleanupSubscription): void {
    LogoutCleanup.activeSubscriptions.add(subscription);
  }

  /**
   * Unregister a subscription (when it naturally completes)
   */
  static unregisterSubscription(subscription: CleanupSubscription): void {
    LogoutCleanup.activeSubscriptions.delete(subscription);
  }

  /**
   * Perform comprehensive logout cleanup
   */
  static async performLogoutCleanup(
    options: LogoutCleanupOptions = {},
  ): Promise<void> {
    const {
      clearCache = true,
      cancelSubscriptions = true,
      suppressErrors = true,
    } = options;

    logger.info('🧹 Starting Apollo logout cleanup...');
    LogoutCleanup.isLoggingOut = true;

    try {
      // 1. Cancel scheduled token refresh
      cancelTokenRefresh();

      // 2. Cancel pending cache persistence
      cancelCachePersistence();

      // 3. Cancel all active subscriptions
      if (cancelSubscriptions) {
        LogoutCleanup.cancelAllSubscriptions();
      }

      // 4. Stop all in-flight queries
      LogoutCleanup.stopInFlightQueries();

      // 5. Clear Apollo cache (only cache we need now)
      if (clearCache) {
        await LogoutCleanup.clearApolloCache();
      }

      logger.info('✅ Apollo logout cleanup completed');
    } catch (error) {
      if (!suppressErrors) {
        logger.error('❌ Error during Apollo logout cleanup:', error);
        throw error;
      } else {
        logger.warn('⚠️ Suppressed error during logout cleanup:', error);
      }
    }
  }

  /**
   * Complete the logout process and reset flags
   */
  static completeLogout(): void {
    LogoutCleanup.isLoggingOut = false;
    LogoutCleanup.activeSubscriptions.clear();
    logger.info('🏁 Apollo logout process completed');
  }

  /**
   * Cancel all active subscriptions
   */
  private static cancelAllSubscriptions(): void {
    logger.info(
      `🔌 Cancelling ${LogoutCleanup.activeSubscriptions.size} active subscriptions`,
    );

    LogoutCleanup.activeSubscriptions.forEach(subscription => {
      try {
        if (typeof subscription === 'function') {
          subscription(); // For React Navigation listeners
        } else if (typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      } catch (error) {
        logger.warn('Failed to unsubscribe:', error);
      }
    });

    LogoutCleanup.activeSubscriptions.clear();
  }

  /**
   * Stop all in-flight GraphQL queries and clean up WebSocket
   */
  private static stopInFlightQueries(): void {
    try {
      // Stop all queries by stopping the network layer temporarily
      client.stop();

      // Disposing the socket also turns auto-reconnect off, so nothing dials
      // again on the credentials this is in the middle of clearing.
      disposeWebSocket();
      logger.info('🔌 WebSocket connection disposed');

      logger.info('🛑 Stopped all in-flight queries and connections');
    } catch (error) {
      logger.warn('Failed to stop in-flight queries:', error);
    }
  }

  /**
   * Clear Apollo cache and persistent storage
   */
  private static async clearApolloCache(): Promise<void> {
    try {
      await client.clearStore();

      // Run garbage collection with result cache reset
      // Per Apollo docs: "call gc() after evict() operations"
      const cache = client.cache as InMemoryCache;
      const removedIds = cache.gc({ resetResultCache: true });
      logger.info(
        `🗑️ Garbage collected ${removedIds.length} unreachable cache objects`,
      );

      // Clear new cache persistence
      apolloCachePersistence.clear();

      // Clear optimistic data persistence
      optimisticDataPersistence.clearAll();

      // Clear storage keys (legacy cleanup)
      storage.remove('apollo-cache');
      storage.remove('navigation_state');
      storage.remove('apollo-client-cache');
      storage.remove('persisted-queries');
      storage.remove('apollo-mutation-queue'); // Clear offline mutation queue
      storage.remove('apollo-queue-current-user'); // Clear queue user ID

      // Get secure storage and clear auth-related data
      try {
        const { getStorage } = await import('#/storage/mmkv');
        const secureStorage = await getStorage();
        secureStorage.remove('apollo-cache');
        secureStorage.remove('navigation_state');
        secureStorage.remove('apollo-client-cache');
        secureStorage.remove('apollo-mutation-queue');
        secureStorage.remove('apollo-queue-current-user');
      } catch (storageError) {
        logger.warn('Failed to clear secure storage:', storageError);
      }

      logger.info(
        '🗑️ Apollo cache, navigation state, and mutation queue cleared',
      );
    } catch (error) {
      logger.warn('Failed to clear Apollo cache:', error);
    }
  }

  /**
   * Utility to check if a GraphQL operation should be skipped during logout
   */
  static shouldSkipOperation(operationName?: string): boolean {
    if (!LogoutCleanup.isLoggingOut) return false;

    // Allow certain operations during logout
    const allowedOperations = ['RefreshToken', 'Logout'];

    return operationName ? !allowedOperations.includes(operationName) : true;
  }

  /**
   * Handle errors that occur during logout gracefully
   */
  static handleLogoutError(error: unknown, operationName?: string): boolean {
    if (!LogoutCleanup.isLoggingOut) return false;

    // Suppress common logout-related errors
    const suppressibleErrors = [
      'No access token available',
      'Response not successful: Received status code 500',
      'Network error',
      'Request failed',
    ];

    const errorMessage = error instanceof Error ? error.message : String(error);
    const shouldSuppress = suppressibleErrors.some(msg =>
      errorMessage.includes(msg),
    );

    if (shouldSuppress) {
      logger.info(
        `🔇 Suppressed logout error for ${operationName}: ${errorMessage}`,
      );
      return true;
    }

    return false;
  }
}

// A session the server ended gets the same teardown a deliberate sign-out does:
// the difference is who decided, not how much of the session is still usable.
//
// `completeLogout()` is not optional. `performLogoutCleanup` latches a flag that
// `authLink` and `errorLink` read to refuse operations; left set, the next
// sign-in cannot send its login mutation.
registerSessionTeardown('apollo', async () => {
  await LogoutCleanup.performLogoutCleanup();
  LogoutCleanup.completeLogout();
});
