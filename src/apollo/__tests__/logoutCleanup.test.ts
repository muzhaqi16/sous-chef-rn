'use no memo';

// ---------------------------------------------------------------------------
// Mocks – jest.mock factories are hoisted, so we cannot reference module-level
// variables. Instead, use inline jest.fn() and retrieve mocks after import.
// ---------------------------------------------------------------------------

const mockClient = {
  clearStore: jest.fn(() => Promise.resolve()),
  stop: jest.fn(),
  cache: { gc: jest.fn(() => []) },
};
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

jest.mock('../links/tokenScheduler', () => ({
  cancelTokenRefresh: jest.fn(),
}));

jest.mock('../offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    clear: jest.fn(),
    cancel: jest.fn(),
  },
  cancelCachePersistence: jest.fn(),
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

jest.mock('#/storage/mmkv');

// wsLink is a static import here. This stub keeps the assertion at the seam —
// that cleanup asks the socket to go away — while what disposal DOES with the
// client (drop it, so the next sign-in is not handed one that has latched
// itself shut) is asserted against the real module in wsLink.test.ts.
jest.mock('../links/wsLink', () => ({
  disposeWebSocket: jest.fn(),
  registerTokenRefresh: jest.fn(),
  registerRefreshInFlightCheck: jest.fn(),
}));

// The same seam: the assertion here is that cleanup asks the refresh module to
// forget its throttle clock. What clearing actually does — zeroing
// `lastRefreshTime` so the next account is not throttled by the previous one's
// — is asserted against the real module in refreshToken.test.ts.
jest.mock('../links/refreshToken', () => ({
  clearRefreshState: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports – after all mocks are declared
// ---------------------------------------------------------------------------

import { LogoutCleanup } from '../logoutCleanup';
import { cancelCachePersistence } from '../offline/ApolloCachePersistence';
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
      expect(mockClient.stop).toHaveBeenCalled();
    });

    it('clears Apollo cache by default', async () => {
      await LogoutCleanup.performLogoutCleanup();
      expect(mockClient.clearStore).toHaveBeenCalled();
      expect(mockClient.cache.gc).toHaveBeenCalledWith({
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
      expect(mockClient.clearStore).not.toHaveBeenCalled();
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

    // `UpdateDevice` is BOTH the sign-out device delete and the push-token
    // rotation. Allowing it by name would let a rotation land after the delete
    // and leave the server pushing to a signed-out account; the delete opts in
    // per call with `allowDuringLogout` instead.
    it('returns true for UpdateDevice — the name alone earns no exemption', async () => {
      await LogoutCleanup.performLogoutCleanup();

      expect(LogoutCleanup.shouldSkipOperation('UpdateDevice')).toBe(true);
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

// logoutCleanup registers the teardown a server-ended session runs; these pin
// what it registered.
describe('session teardown step', () => {
  const runStep = async () => {
    const { runSessionTeardown } = require('#store/sessionTeardown');
    await runSessionTeardown();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    LogoutCleanup.completeLogout();
  });

  it('stops in-flight operations, disposes the socket, and clears the cache', async () => {
    await runStep();

    const { disposeWebSocket } = require('../links/wsLink');

    expect(mockClient.stop).toHaveBeenCalled();
    expect(disposeWebSocket).toHaveBeenCalled();
    expect(apolloCachePersistence.clear).toHaveBeenCalled();
  });

  it('clears the refresh throttle so the next account is not held by this one', async () => {
    // `lastRefreshTime` and `retryCount` are module state that outlives the
    // session, so a sign-out that leaves them set makes the next user's first
    // refresh a no-op inside MIN_REFRESH_INTERVAL.
    await runStep();

    const { clearRefreshState } = require('../links/refreshToken');

    expect(clearRefreshState).toHaveBeenCalled();
  });

  it('leaves the logout latch clear so the next sign-in can send its login', async () => {
    // Left set, the latch would brick the sign-in the session end just sent the
    // user to.
    await runStep();

    expect(LogoutCleanup.isInLogoutProcess()).toBe(false);
  });
});
