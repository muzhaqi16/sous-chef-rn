'use no memo';

// ---------------------------------------------------------------------------
// Mocks – jest.mock factories are hoisted, so we cannot reference module-level
// variables. Instead, use inline jest.fn() and retrieve mocks after import.
// ---------------------------------------------------------------------------

jest.mock('../client', () => ({
  client: {
    clearStore: jest.fn(() => Promise.resolve()),
    stop: jest.fn(),
    cache: { gc: jest.fn(() => []) },
  },
  cancelCachePersistence: jest.fn(),
}));

jest.mock('../links/tokenScheduler', () => ({
  cancelTokenRefresh: jest.fn(),
}));

jest.mock('../offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    clear: jest.fn(),
    cancel: jest.fn(),
  },
}));

jest.mock('../offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    clearAll: jest.fn(),
  },
}));

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({ isLoggingOut: false })),
  },
}));

jest.mock('#/storage/mmkv', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
  },
  getStorage: jest.fn(() =>
    Promise.resolve({
      remove: jest.fn(),
    }),
  ),
  isStorageReady: () => true,
}));

// Mock wsLink dynamic import
jest.mock('../links/wsLink', () => ({
  disposeWebSocket: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports – after all mocks are declared
// ---------------------------------------------------------------------------

import { LogoutCleanup } from '../logoutCleanup';
import { client, cancelCachePersistence } from '../client';
import { cancelTokenRefresh } from '../links/tokenScheduler';
import { apolloCachePersistence } from '../offline/ApolloCachePersistence';
import { optimisticDataPersistence } from '../offline/OptimisticDataPersistence';
import { storage } from '#/storage/mmkv';
import { useStore } from '#store';

describe('LogoutCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    LogoutCleanup.completeLogout();
  });

  describe('isInLogoutProcess', () => {
    it('returns false when not logging out', () => {
      expect(LogoutCleanup.isInLogoutProcess()).toBe(false);
    });

    it('returns true when global store says logging out', () => {
      (useStore.getState as jest.Mock).mockReturnValueOnce({
        isLoggingOut: true,
      });
      expect(LogoutCleanup.isInLogoutProcess()).toBe(true);
    });
  });

  describe('registerSubscription / unregisterSubscription', () => {
    it('tracks subscriptions', () => {
      const sub = { unsubscribe: jest.fn() };
      LogoutCleanup.registerSubscription(sub);
      LogoutCleanup.completeLogout();
    });

    it('unregister removes the subscription from tracking', () => {
      const sub = { unsubscribe: jest.fn() };
      LogoutCleanup.registerSubscription(sub);
      LogoutCleanup.unregisterSubscription(sub);
      LogoutCleanup.completeLogout();
    });
  });

  describe('performLogoutCleanup', () => {
    it('cancels token refresh', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(cancelTokenRefresh).toHaveBeenCalled();
    });

    it('cancels cache persistence', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(cancelCachePersistence).toHaveBeenCalled();
    });

    it('stops in-flight queries', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(client.stop).toHaveBeenCalled();
    });

    it('clears Apollo cache by default', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(client.clearStore).toHaveBeenCalled();
      expect(client.cache.gc).toHaveBeenCalledWith({
        resetResultCache: true,
      });
      expect(apolloCachePersistence.clear).toHaveBeenCalled();
      expect(optimisticDataPersistence.clearAll).toHaveBeenCalled();
    });

    it('clears legacy storage keys', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(storage.remove).toHaveBeenCalledWith('apollo-cache');
      expect(storage.remove).toHaveBeenCalledWith('navigation_state');
      expect(storage.remove).toHaveBeenCalledWith('apollo-client-cache');
      expect(storage.remove).toHaveBeenCalledWith('persisted-queries');
      expect(storage.remove).toHaveBeenCalledWith('apollo-mutation-queue');
      expect(storage.remove).toHaveBeenCalledWith('apollo-queue-current-user');
    });

    it('skips cache clearing when clearCache is false', async () => {
      await LogoutCleanup.performLogoutCleanup({ clearCache: false });
      expect(client.clearStore).not.toHaveBeenCalled();
    });

    it('suppresses errors by default', async () => {
      (cancelTokenRefresh as jest.Mock).mockImplementationOnce(() => {
        throw new Error('token cancel failed');
      });
      // Should not throw
      await LogoutCleanup.performLogoutCleanup();
    });

    it('re-throws errors when suppressErrors is false', async () => {
      (cancelTokenRefresh as jest.Mock).mockImplementationOnce(() => {
        throw new Error('token cancel failed');
      });

      await expect(
        LogoutCleanup.performLogoutCleanup({ suppressErrors: false }),
      ).rejects.toThrow('token cancel failed');
    });

    it('cancels subscriptions with unsubscribe method', async () => {
      const sub = { unsubscribe: jest.fn() };
      LogoutCleanup.registerSubscription(sub);

      await LogoutCleanup.performLogoutCleanup();

      expect(sub.unsubscribe).toHaveBeenCalled();
    });

    it('cancels function-style subscriptions (navigation listeners)', async () => {
      const listener = jest.fn();
      LogoutCleanup.registerSubscription(listener);

      await LogoutCleanup.performLogoutCleanup();

      expect(listener).toHaveBeenCalled();
    });

    it('skips subscription cancellation when cancelSubscriptions is false', async () => {
      const sub = { unsubscribe: jest.fn() };
      LogoutCleanup.registerSubscription(sub);

      await LogoutCleanup.performLogoutCleanup({
        cancelSubscriptions: false,
      });

      expect(sub.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('completeLogout', () => {
    it('resets the isLoggingOut flag', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(LogoutCleanup.isInLogoutProcess()).toBe(true);

      LogoutCleanup.completeLogout();
      expect(LogoutCleanup.isInLogoutProcess()).toBe(false);
    });
  });

  describe('shouldSkipOperation', () => {
    it('returns false when not logging out', () => {
      expect(LogoutCleanup.shouldSkipOperation('SomeQuery')).toBe(false);
    });

    it('returns true for non-allowed operations during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      expect(LogoutCleanup.shouldSkipOperation('GetShoppingList')).toBe(true);
    });

    it('returns false for RefreshToken during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      expect(LogoutCleanup.shouldSkipOperation('RefreshToken')).toBe(false);
    });

    it('returns false for Logout operation during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      expect(LogoutCleanup.shouldSkipOperation('Logout')).toBe(false);
    });

    it('returns true when no operation name during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      expect(LogoutCleanup.shouldSkipOperation()).toBe(true);
    });
  });

  describe('handleLogoutError', () => {
    it('returns false when not logging out', () => {
      const error = new Error('some error');
      expect(LogoutCleanup.handleLogoutError(error)).toBe(false);
    });

    it('suppresses "No access token available" errors during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      const result = LogoutCleanup.handleLogoutError(
        new Error('No access token available'),
        'SomeQuery',
      );
      expect(result).toBe(true);
    });

    it('suppresses "Network error" during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      const result = LogoutCleanup.handleLogoutError(
        new Error('Network error: Failed to fetch'),
      );
      expect(result).toBe(true);
    });

    it('suppresses "Response not successful: Received status code 500"', async () => {
      await LogoutCleanup.performLogoutCleanup();

      const result = LogoutCleanup.handleLogoutError(
        new Error('Response not successful: Received status code 500'),
      );
      expect(result).toBe(true);
    });

    it('suppresses "Request failed" during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      const result = LogoutCleanup.handleLogoutError(
        new Error('Request failed with status 403'),
      );
      expect(result).toBe(true);
    });

    it('does not suppress unknown errors during logout', async () => {
      await LogoutCleanup.performLogoutCleanup();

      const result = LogoutCleanup.handleLogoutError(
        new Error('Unexpected error xyz'),
      );
      expect(result).toBe(false);
    });
  });
});
