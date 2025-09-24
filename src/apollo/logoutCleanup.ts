import { client } from './client';
import { useStore } from '#store';
import { storage } from '#/storage/mmkv';

interface LogoutCleanupOptions {
  clearCache?: boolean;
  cancelSubscriptions?: boolean;
  suppressErrors?: boolean;
}

/**
 * Centralized Apollo cleanup utility for logout
 * Handles cache clearing, subscription cancellation, and error suppression
 */
export class LogoutCleanup {
  private static isLoggingOut = false;
  private static activeSubscriptions = new Set<any>();

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
  static registerSubscription(subscription: any): void {
    LogoutCleanup.activeSubscriptions.add(subscription);
  }

  /**
   * Unregister a subscription (when it naturally completes)
   */
  static unregisterSubscription(subscription: any): void {
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

    console.log('🧹 Starting Apollo logout cleanup...');
    LogoutCleanup.isLoggingOut = true;

    try {
      // 1. Cancel all active subscriptions
      if (cancelSubscriptions) {
        LogoutCleanup.cancelAllSubscriptions();
      }

      // 2. Stop all in-flight queries
      await LogoutCleanup.stopInFlightQueries();

      // 3. Clear Apollo cache (only cache we need now)
      if (clearCache) {
        await LogoutCleanup.clearApolloCache();
      }

      console.log('✅ Apollo logout cleanup completed');
    } catch (error) {
      if (!suppressErrors) {
        console.error('❌ Error during Apollo logout cleanup:', error);
        throw error;
      } else {
        console.warn('⚠️ Suppressed error during logout cleanup:', error);
      }
    }
  }

  /**
   * Complete the logout process and reset flags
   */
  static completeLogout(): void {
    LogoutCleanup.isLoggingOut = false;
    LogoutCleanup.activeSubscriptions.clear();
    console.log('🏁 Apollo logout process completed');
  }

  /**
   * Cancel all active subscriptions
   */
  private static cancelAllSubscriptions(): void {
    console.log(
      `🔌 Cancelling ${LogoutCleanup.activeSubscriptions.size} active subscriptions`,
    );

    LogoutCleanup.activeSubscriptions.forEach(subscription => {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        } else if (subscription && typeof subscription === 'function') {
          subscription(); // For React Navigation listeners
        }
      } catch (error) {
        console.warn('Failed to unsubscribe:', error);
      }
    });

    LogoutCleanup.activeSubscriptions.clear();
  }

  /**
   * Stop all in-flight GraphQL queries and clean up WebSocket
   */
  private static async stopInFlightQueries(): Promise<void> {
    try {
      // Stop all queries by stopping the network layer temporarily
      client.stop();

      // Clean up WebSocket connections
      try {
        const { disposeWebSocket } = await import('./links/wsLink');
        disposeWebSocket();
        console.log('🔌 WebSocket connection disposed');
      } catch (wsError) {
        console.warn('Failed to dispose WebSocket:', wsError);
      }

      console.log('🛑 Stopped all in-flight queries and connections');
    } catch (error) {
      console.warn('Failed to stop in-flight queries:', error);
    }
  }

  /**
   * Clear Apollo cache and persistent storage
   */
  private static async clearApolloCache(): Promise<void> {
    try {
      await client.clearStore();

      // Clear storage keys
      storage.delete('apollo-cache');
      storage.delete('navigation_state');
      storage.delete('apollo-client-cache');
      storage.delete('persisted-queries');

      // Get secure storage and clear auth-related data
      try {
        const { getStorage } = await import('#/storage/mmkv');
        const secureStorage = await getStorage();
        secureStorage.delete('apollo-cache');
        secureStorage.delete('navigation_state');
        secureStorage.delete('apollo-client-cache');
      } catch (storageError) {
        console.warn('Failed to clear secure storage:', storageError);
      }

      console.log('🗑️ Apollo cache and navigation state cleared');
    } catch (error) {
      console.warn('Failed to clear Apollo cache:', error);
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
  static handleLogoutError(error: any, operationName?: string): boolean {
    if (!LogoutCleanup.isLoggingOut) return false;

    // Suppress common logout-related errors
    const suppressibleErrors = [
      'No access token available',
      'Response not successful: Received status code 500',
      'Network error',
      'Request failed',
    ];

    const errorMessage = error.message || error.toString();
    const shouldSuppress = suppressibleErrors.some(msg =>
      errorMessage.includes(msg),
    );

    if (shouldSuppress) {
      console.log(
        `🔇 Suppressed logout error for ${operationName}: ${errorMessage}`,
      );
      return true;
    }

    return false;
  }
}
