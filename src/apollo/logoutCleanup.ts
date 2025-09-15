import {client} from './client';
import {pantryStorage} from '#/storage/pantryCache';
import {shoppingListStorage} from '#/storage/shoppingListCache';
import {useStore} from '#store';

interface LogoutCleanupOptions {
  clearCache?: boolean;
  cancelSubscriptions?: boolean;
  clearPantryCache?: boolean;
  clearShoppingListCache?: boolean;
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
      clearPantryCache = true,
      clearShoppingListCache = true,
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

      // 3. Clear Apollo cache
      if (clearCache) {
        await LogoutCleanup.clearApolloCache();
      }

      // 4. Clear pantry-specific caches
      if (clearPantryCache) {
        LogoutCleanup.clearPantryCaches();
      }

      // 5. Clear shopping list caches
      if (clearShoppingListCache) {
        LogoutCleanup.clearShoppingListCaches();
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
   * Stop all in-flight GraphQL queries
   */
  private static async stopInFlightQueries(): Promise<void> {
    try {
      // Stop all queries by stopping the network layer temporarily
      await client.stop();
      console.log('🛑 Stopped all in-flight queries');
    } catch (error) {
      console.warn('Failed to stop in-flight queries:', error);
    }
  }

  /**
   * Clear Apollo cache and persistent storage
   */
  private static async clearApolloCache(): Promise<void> {
    try {
      // Get client dynamically to avoid circular dependency
      const {client} = await import('#/apollo/client');
      await client.clearStore();

      const {storage} = await import('#/storage/mmkv');
      storage.delete('apollo-cache');
      storage.delete('navigation_state');

      console.log('🗑️ Apollo cache and navigation state cleared');
    } catch (error) {
      console.warn('Failed to clear Apollo cache:', error);
    }
  }

  /**
   * Clear pantry-specific caches
   */
  private static clearPantryCaches(): void {
    try {
      pantryStorage.clearAllPantryCaches();
      console.log('🏪 Pantry caches cleared');
    } catch (error) {
      console.warn('Failed to clear pantry caches:', error);
    }
  }

  /**
   * Clear shopping list caches
   */
  private static clearShoppingListCaches(): void {
    try {
      shoppingListStorage.clearAllShoppingListCaches();
      console.log('🛒 Shopping list caches cleared');
    } catch (error) {
      console.warn('Failed to clear shopping list caches:', error);
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
