'use no memo';

// Mock tokenScheduler and refreshToken (needed transitively by store)
jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

// Mock keychain. `clearCredentials` is the stored-login tier (biometric /
// remembered login) and is mocked purely so the assertion that session end
// never touches it has something real to watch.
jest.mock('#/storage/keychain', () => ({
  clearTempRegistrationPassword: jest.fn(() => Promise.resolve()),
  clearSessionTokens: jest.fn(() => Promise.resolve()),
  loadSessionTokens: jest.fn(() => Promise.resolve(null)),
  saveSessionTokens: jest.fn(() => Promise.resolve()),
  clearCredentials: jest.fn(() => Promise.resolve()),
}));

// Mock apollo client module
jest.mock('#/apollo/client', () => ({
  client: {
    clearStore: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('#/apollo/offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    clear: jest.fn(),
  },
}));

// Apollo registers these at client init; here the test stands in for it, which
// is what makes every step of the reset observable.
const apolloReset = {
  cancelTokenRefresh: jest.fn(),
  clearPersistedCache: jest.fn(),
  clearStore: jest.fn(() => Promise.resolve()),
};

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useBarcodeScannerStore } from '#features/barcode/store/barcodeScannerStore';
import { RESET_SCENARIOS, createResetManager } from '../resetManager';
import {
  clearApolloResetBridge,
  registerApolloResetBridge,
} from '../apolloResetBridge';
import type { RootState } from '#store/index';
import { storage } from '#/storage/mmkv';
import {
  clearTempRegistrationPassword,
  clearCredentials,
} from '#/storage/keychain';
import { cancelTokenRefresh } from '#/apollo/links/tokenScheduler';
import {
  registerSessionTeardown,
  clearSessionTeardown,
} from '../sessionTeardown';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { logger } from '#/utils/environment';

type SetCall = [Partial<RootState>];

// The reset applies auth fields in one `set`; find that call rather than
// assuming its index, since the cache clear can interleave `set` calls.
const findAuthResetCall = (mockSet: jest.Mock) =>
  mockSet.mock.calls.find(
    (call: SetCall) => call[0]?.user === null && call[0]?.accessToken === null,
  );

// Both halves of the cache clear. The persisted blob matters most — it is the
// copy of the previous account's data that survives a restart — and it is
// cleared in its own try, so a failure there cannot skip the in-memory clear.
const expectPersistedCacheCleared = () => {
  expect(apolloReset.clearPersistedCache).toHaveBeenCalled();
  expect(apolloReset.clearStore).toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalledWith(
    expect.stringContaining('Error clearing persisted Apollo cache:'),
    expect.anything(),
  );
};

describe('resetManager', () => {
  describe('RESET_SCENARIOS', () => {
    it('LOGOUT clears auth and UI, preserves preferences, clears Apollo cache', () => {
      expect(RESET_SCENARIOS.LOGOUT).toEqual({
        auth: true,
        ui: true,
        preferences: false,
        clearApolloCache: true,
      });
    });

    it('SESSION_EXPIRED clears auth only, preserves cache for offline', () => {
      expect(RESET_SCENARIOS.SESSION_EXPIRED).toEqual({
        auth: true,
        ui: false,
        preferences: false,
        clearApolloCache: false,
      });
    });

    it('FULL_RESET clears everything', () => {
      expect(RESET_SCENARIOS.FULL_RESET).toEqual({
        auth: true,
        ui: true,
        preferences: true,
        clearApolloCache: true,
      });
    });

    it('ONBOARDING_RESET preserves auth, clears UI and preferences', () => {
      expect(RESET_SCENARIOS.ONBOARDING_RESET).toEqual({
        auth: false,
        ui: true,
        preferences: true,
        clearApolloCache: false,
      });
    });
  });

  describe('createResetManager', () => {
    let mockSet: jest.Mock;
    let mockGet: jest.Mock;
    let resetManager: ReturnType<typeof createResetManager>;

    beforeEach(() => {
      jest.clearAllMocks();
      registerApolloResetBridge(apolloReset);
      mockSet = jest.fn();
      mockGet = jest.fn(() => ({}));
      resetManager = createResetManager(mockSet, mockGet);
    });

    afterEach(() => {
      clearApolloResetBridge();
    });

    describe('resetStore', () => {
      it('accepts a string scenario name', async () => {
        await resetManager.resetStore('LOGOUT');
        expect(mockSet).toHaveBeenCalled();
        expectPersistedCacheCleared();
      });

      it('accepts a custom ResetOptions object', async () => {
        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });
        expect(mockSet).toHaveBeenCalled();
      });

      it('resets auth state when auth option is true', async () => {
        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.user).toBeNull();
        expect(firstCall.accessToken).toBeNull();
        expect(firstCall.refreshToken).toBeNull();
        expect(firstCall.selectedHomeId).toBeNull();
        expect(firstCall.selectedPantryId).toBeNull();
        expect(firstCall.selectedShoppingListId).toBeNull();
        expect(firstCall.selectedMealPlanId).toBeNull();
        expect(firstCall.hasInitializedHomeData).toBe(false);
        expect(firstCall.isHomeSelectionReady).toBe(false);
      });

      it('an auth reset is a superset of clearAuth: cancels the refresh timer and resets the auth-progress flags', async () => {
        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });

        // Left armed, the proactive timer fires against tokens this reset just
        // cleared; left set, the two flags describe a session that is gone.
        expect(apolloReset.cancelTokenRefresh).toHaveBeenCalled();
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.isAutoLoggingIn).toBe(false);
        expect(firstCall.sessionTokensInKeychain).toBe(false);
      });

      it('leaves the refresh timer and auth-progress flags alone when auth is false', async () => {
        await resetManager.resetStore({
          auth: false,
          ui: true,
          preferences: false,
          clearApolloCache: false,
        });

        expect(cancelTokenRefresh).not.toHaveBeenCalled();
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.isAutoLoggingIn).toBeUndefined();
        expect(firstCall.sessionTokensInKeychain).toBeUndefined();
      });

      it('resets UI state when ui option is true', async () => {
        await resetManager.resetStore({
          auth: false,
          ui: true,
          preferences: false,
          clearApolloCache: false,
        });
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.isLoading).toBe(false);
        expect(firstCall.isError).toBe(false);
        expect(firstCall.bottomSheetVisible).toBe(false);
        expect(firstCall.toastMessage).toBeNull();
        expect(firstCall.globalSearchQuery).toBe('');
      });

      it('resets preferences when preferences option is true', async () => {
        // Seeded, or the feature-store assertions below pass on an already-empty
        // store and prove nothing.
        useNotificationStore
          .getState()
          .linkExpirationData('n1', { pantryItemName: 'Milk' });
        useBarcodeScannerStore
          .getState()
          .addToRecentlyScanned({ id: 's1', name: 'Milk', upc: '01' });

        await resetManager.resetStore({
          auth: false,
          ui: false,
          preferences: true,
          clearApolloCache: false,
        });
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.onBoardingStep).toBeNull();
        // Feature stores are cleared through the session-scoped registry rather
        // than by spreading their initial state into the root — and on this
        // branch too, so ONBOARDING_RESET still empties them.
        expect(useNotificationStore.getState().pendingExpirationLinks).toEqual(
          {},
        );
        expect(useBarcodeScannerStore.getState().recentlyScanned).toEqual([]);
      });

      it('clears the persisted Apollo cache when clearApolloCache is true', async () => {
        await resetManager.resetStore({
          auth: false,
          ui: false,
          preferences: false,
          clearApolloCache: true,
        });
        expect(mockSet).toHaveBeenCalled();
        expectPersistedCacheCleared();
      });

      it('skips Apollo cache clearing when clearApolloCache is false', async () => {
        await resetManager.resetStore({
          auth: false,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });
        expect(mockSet).toHaveBeenCalled();
        expect(apolloCachePersistence.clear).not.toHaveBeenCalled();
      });

      it('clears auth from storage when auth is true', async () => {
        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });
        expect(clearTempRegistrationPassword).toHaveBeenCalled();
        expect(storage.remove).toHaveBeenCalledWith('accessToken');
        expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      });

      it('handles missing zustand data gracefully', async () => {
        // Should not throw even with no stored data
        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });
        expect(clearTempRegistrationPassword).toHaveBeenCalled();
      });

      it('ensures isHydrated remains true after reset', async () => {
        await resetManager.resetStore('SESSION_EXPIRED');
        // Last set call should be { isHydrated: true }
        const lastCall = mockSet.mock.calls[mockSet.mock.calls.length - 1][0];
        expect(lastCall.isHydrated).toBe(true);
      });

      it('logs and swallows a persisted-cache clear failure without abandoning the reset', async () => {
        apolloReset.clearPersistedCache.mockImplementationOnce(() => {
          throw new Error('storage unavailable');
        });

        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: true,
        });

        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error clearing persisted Apollo cache:'),
          expect.anything(),
        );
        // The rest of the reset still runs, so a storage failure can't leave
        // the user half signed-out.
        expect(findAuthResetCall(mockSet)).toBeDefined();
        expect(clearTempRegistrationPassword).toHaveBeenCalled();
      });

      it('clears the persisted blob even when the in-memory clear fails', async () => {
        // Separately guarded on purpose: the persisted blob is the copy that
        // survives a restart, so an in-memory failure must not leave it behind.
        apolloReset.clearStore.mockRejectedValueOnce(
          new Error('cache unavailable'),
        );

        await resetManager.resetStore({
          auth: true,
          ui: false,
          preferences: false,
          clearApolloCache: true,
        });

        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error clearing Apollo cache:'),
          expect.anything(),
        );
        expect(apolloReset.clearPersistedCache).toHaveBeenCalledTimes(1);
      });

      it('does not reset auth state when auth option is false', async () => {
        await resetManager.resetStore({
          auth: false,
          ui: false,
          preferences: false,
          clearApolloCache: false,
        });
        const firstCall = mockSet.mock.calls[0][0];
        // Auth fields should NOT be present when auth=false
        expect(firstCall.user).toBeUndefined();
        expect(firstCall.accessToken).toBeUndefined();
      });
    });

    describe('convenience methods', () => {
      it('logout resets with LOGOUT scenario and sets auth navigation', async () => {
        await resetManager.logout();
        // Should have called set with auth reset and then navigationState: 'auth'
        const lastCall = mockSet.mock.calls[mockSet.mock.calls.length - 1][0];
        expect(lastCall.navigationState).toBe('auth');
        expectPersistedCacheCleared();
      });

      it('sessionExpired resets with SESSION_EXPIRED scenario', async () => {
        await resetManager.sessionExpired();
        expect(mockSet).toHaveBeenCalled();
      });

      it('fullReset resets with FULL_RESET scenario', async () => {
        await resetManager.fullReset();
        expect(mockSet).toHaveBeenCalled();
        expectPersistedCacheCleared();
      });

      it('resetOnboarding resets with ONBOARDING_RESET scenario', async () => {
        await resetManager.resetOnboarding();
        expect(mockSet).toHaveBeenCalled();
      });

      it('tokenRefreshFailed with auth_rejected performs the full session-end cleanup', async () => {
        await resetManager.tokenRefreshFailed('auth_rejected');

        // Delegates to endSession, so it gets the same cleanup as the
        // link-layer verdicts rather than its own slightly different one.
        const authCall = findAuthResetCall(mockSet);
        expect(authCall).toBeDefined();
        expect(authCall?.[0].isAutoLoggingIn).toBe(false);
        expect(authCall?.[0].sessionTokensInKeychain).toBe(false);
        expect(apolloReset.cancelTokenRefresh).toHaveBeenCalled();
        expectPersistedCacheCleared();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('refresh_rejected'),
        );
      });

      it.each(['network', 'unknown'] as const)(
        'tokenRefreshFailed with %s preserves auth and the cache, sets needsTokenRefresh',
        async reason => {
          await resetManager.tokenRefreshFailed(reason);

          expect(findAuthResetCall(mockSet)).toBeUndefined();
          const flagCall = mockSet.mock.calls.find(
            (call: SetCall) => call[0]?.needsTokenRefresh === true,
          );
          expect(flagCall).toBeDefined();

          // A recoverable failure must leave the offline cache intact — this is
          // the branch that keeps a flaky connection from wiping the device.
          expect(apolloCachePersistence.clear).not.toHaveBeenCalled();
          expect(cancelTokenRefresh).not.toHaveBeenCalled();
        },
      );
    });

    describe('endSession', () => {
      const REASONS = [
        'refresh_rejected',
        'refresh_token_dead',
        'account_inactive',
        'session_revoked',
      ] as const;

      it.each(REASONS)(
        'performs the full cleanup for reason %s',
        async reason => {
          await resetManager.endSession(reason);

          const authCall = findAuthResetCall(mockSet);
          expect(authCall).toBeDefined();
          const authState = authCall?.[0];

          // In-memory auth state
          expect(authState?.user).toBeNull();
          expect(authState?.accessToken).toBeNull();
          expect(authState?.refreshToken).toBeNull();
          expect(authState?.isAutoLoggingIn).toBe(false);
          expect(authState?.sessionTokensInKeychain).toBe(false);
          // Navigation selections belonging to the ended session
          expect(authState?.selectedHomeId).toBeNull();
          expect(authState?.selectedPantryId).toBeNull();
          expect(authState?.selectedShoppingListId).toBeNull();
          expect(authState?.selectedMealPlanId).toBeNull();
          expect(authState?.hasInitializedHomeData).toBe(false);
          expect(authState?.isHomeSelectionReady).toBe(false);

          // Scheduled refresh, keychain tier, and persisted tokens
          expect(apolloReset.cancelTokenRefresh).toHaveBeenCalled();
          expect(clearTempRegistrationPassword).toHaveBeenCalled();
          expect(storage.remove).toHaveBeenCalledWith('accessToken');
          expect(storage.remove).toHaveBeenCalledWith('refreshToken');

          // Persisted Apollo cache
          expectPersistedCacheCleared();
        },
      );

      it('performs identical cleanup regardless of reason', async () => {
        // `reason` is for the log line only. If a future edit makes it branch
        // the cleanup, the two snapshots below stop matching.
        const cleanupFor = async (reason: (typeof REASONS)[number]) => {
          jest.clearAllMocks();
          const set = jest.fn();
          const get: jest.Mock = jest.fn(() => ({}));
          await createResetManager(set, get).endSession(reason);
          return {
            authState: findAuthResetCall(set)?.[0],
            setCallCount: set.mock.calls.length,
            refreshCancelled: (cancelTokenRefresh as jest.Mock).mock.calls
              .length,
            persistenceCleared: (apolloCachePersistence.clear as jest.Mock).mock
              .calls.length,
          };
        };

        const baseline = await cleanupFor(REASONS[0]);
        for (const reason of REASONS.slice(1)) {
          expect(await cleanupFor(reason)).toEqual(baseline);
        }
      });

      it('logs the reason once', async () => {
        await resetManager.endSession('account_inactive');

        const sessionLogs = (logger.info as jest.Mock).mock.calls.filter(
          ([msg]: [string]) =>
            typeof msg === 'string' && msg.includes('account_inactive'),
        );
        expect(sessionLogs).toHaveLength(1);
      });

      // Clearing the tokens stops nothing already running: the socket keeps
      // dialling, queries keep landing, the queue keeps waking — all against
      // credentials the server has refused.
      describe('stopping the transports', () => {
        afterEach(() => {
          clearSessionTeardown();
        });

        it('runs the registered teardown before clearing the store', async () => {
          const order: string[] = [];
          registerSessionTeardown('apollo', () => {
            order.push('teardown');
          });
          const set = jest.fn(() => {
            order.push('set');
          });

          await createResetManager(
            set,
            jest.fn(() => ({} as RootState)) as never,
          ).endSession('refresh_token_dead');

          expect(order[0]).toBe('teardown');
          expect(order).toContain('set');
        });

        it.each(REASONS)('runs it for reason %s', async reason => {
          const teardown = jest.fn();
          registerSessionTeardown('apollo', teardown);

          await resetManager.endSession(reason);

          expect(teardown).toHaveBeenCalledTimes(1);
        });

        it('still clears the session when a teardown step throws', async () => {
          // The tokens have to go even if the socket refuses to close.
          registerSessionTeardown('apollo', () => {
            throw new Error('dispose failed');
          });

          await resetManager.endSession('session_revoked');

          expect(findAuthResetCall(mockSet)?.[0]?.accessToken).toBeNull();
          expectPersistedCacheCleared();
        });
      });

      it('removes the persisted cache blob so the next sign-in restores nothing', async () => {
        await resetManager.endSession('account_inactive');

        // ApolloCachePersistence.clear() drops the MMKV keys a cold start
        // restores from, so the ended session's normalized entities cannot
        // reappear under whoever signs in next.
        expect(apolloReset.clearPersistedCache).toHaveBeenCalledTimes(1);
      });

      it.each(REASONS)(
        'leaves the stored login credentials intact for reason %s',
        async reason => {
          await resetManager.endSession(reason);

          // Ending a session must not cost the user their biometric /
          // remembered login — they need to be able to sign straight back in.
          // Only the session-token tier goes. Nothing on this path calls
          // clearCredentials today; this pins that, because adding such a call
          // to clearAuthFromStorage would break biometric sign-in silently.
          expect(clearCredentials).not.toHaveBeenCalled();

          // Same for the preferences that say credentials exist — a reset that
          // nulls these would hide a keychain entry that is still there.
          const authState = findAuthResetCall(mockSet)?.[0];
          expect(authState).toBeDefined();
          expect(authState).not.toHaveProperty('rememberMe');
          expect(authState).not.toHaveProperty('hasStoredCredentials');
        },
      );
    });
  });
});
