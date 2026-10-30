import { getApolloClient } from '#/apollo/clientRegistry';
import type { InMemoryCache } from '@apollo/client';
import { storage } from '#/store/deviceStorage';
import { apolloCachePersistence } from './offline/ApolloCachePersistence';
import { optimisticDataPersistence } from './offline/OptimisticDataPersistence';
import { pendingWritesOf } from './pendingWrites/pendingWrites';
import { cancelTokenRefresh } from './links/tokenScheduler';
import { disposeWebSocket } from './links/wsLink';
import { clearRefreshState } from './links/refreshToken';
import { registerSessionTeardown } from '#store/sessionTeardown';
import { isSessionEnding, resetSessionEndingGate } from '#store/sessionEnding';
import { logger } from '#/utils/environment';
import { RefreshTokenDocument } from '#operations/auth/auth.generated';
import { operationNameOf } from './utils/documentOperation';
import { forgetAnswersSinceSwitch } from './answeredSinceSwitch';

/**
 * The Apollo half of every session end: stops in-flight work and the socket,
 * then clears the cache and its persisted copies.
 */
export class LogoutCleanup {
  /**
   * Check if the app is currently in logout process
   */
  static isInLogoutProcess(): boolean {
    return isSessionEnding();
  }

  /**
   * Perform comprehensive logout cleanup. A failure is logged, never thrown:
   * the store reset that follows must not be stopped by it.
   */
  static async performLogoutCleanup(): Promise<void> {
    logger.info('🧹 Starting Apollo logout cleanup...');

    try {
      // 1. Cancel scheduled token refresh
      cancelTokenRefresh();

      // 2. Cancel pending cache persistence
      apolloCachePersistence.cancel();

      // 3. Stop all in-flight queries
      LogoutCleanup.stopInFlightQueries();

      // 4. Clear Apollo cache (only cache we need now)
      await LogoutCleanup.clearApolloCache();

      // 5. Forget which queries were answered since a language switch: the
      // keys carry the account's search terms and ids.
      forgetAnswersSinceSwitch();

      logger.info('✅ Apollo logout cleanup completed');
    } catch (error) {
      logger.warn('⚠️ Suppressed error during logout cleanup:', error);
    }
  }

  /** Test seam: the gate is released by the scope that opened it. */
  static completeLogout(): void {
    resetSessionEndingGate();
    logger.info('🏁 Apollo logout process completed');
  }

  /**
   * Stop all in-flight GraphQL queries and clean up WebSocket
   */
  private static stopInFlightQueries(): void {
    try {
      // Stop all queries by stopping the network layer temporarily
      getApolloClient()?.stop();

      // Disposing the socket also turns auto-reconnect off, so nothing dials
      // again on the credentials this is in the middle of clearing.
      disposeWebSocket();
      logger.info('🔌 WebSocket connection disposed');

      // `lastRefreshTime` and `retryCount` are module state, so without this the
      // next account's first refresh is throttled by the previous one's clock.
      clearRefreshState();

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
      const client = getApolloClient();
      if (!client) return;
      await client.clearStore();
      pendingWritesOf(client.cache).clear();

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

      // The offline queue is NOT cleared here. A server-ended session is not the
      // user choosing to discard unsynced work, so only `queueManager.onLogout()`
      // — which fires on a deliberate sign-out — may delete queued entries.
      storage.remove('apollo-cache');
      storage.remove('navigation_state');
      storage.remove('apollo-client-cache');
      storage.remove('persisted-queries');

      logger.info('🗑️ Apollo cache and navigation state cleared');
    } catch (error) {
      logger.warn('Failed to clear Apollo cache:', error);
    }
  }

  /**
   * Utility to check if a GraphQL operation should be skipped during logout
   */
  static shouldSkipOperation(operationName?: string): boolean {
    if (!LogoutCleanup.isInLogoutProcess()) return false;

    // Names only. A call that belongs to the sign-out but shares its name with
    // one that does not — `UpdateDevice` is both the device delete and the push
    // token rotation — opts in per call via `allowDuringLogout` instead.
    return operationName
      ? operationName !== operationNameOf(RefreshTokenDocument)
      : true;
  }
}

// A server-ended session gets the same teardown as a sign-out. The gate belongs
// to whoever started the session end (`whileSessionEnds`), not to this step: it
// must stay closed for the store reset that follows.
registerSessionTeardown('apollo', async () => {
  await LogoutCleanup.performLogoutCleanup();
});
