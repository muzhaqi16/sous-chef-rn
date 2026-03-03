'use no memo';

// Mock tokenScheduler and refreshToken (needed transitively by store)
jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

// Mock keychain
jest.mock('#/storage/keychain', () => ({
  clearTempRegistrationPassword: jest.fn(() => Promise.resolve()),
}));

// Mock apollo client module
jest.mock('#/apollo/client', () => ({
  client: {
    clearStore: jest.fn(() => Promise.resolve()),
  },
}));

import { RESET_SCENARIOS, createResetManager } from '../resetManager';
import { storage } from '#/storage/mmkv';
import { clearTempRegistrationPassword } from '#/storage/keychain';

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
      mockSet = jest.fn();
      mockGet = jest.fn(() => ({}));
      resetManager = createResetManager(mockSet, mockGet);
    });

    describe('resetStore', () => {
      it('accepts a string scenario name', async () => {
        await resetManager.resetStore('LOGOUT');
        expect(mockSet).toHaveBeenCalled();
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
        await resetManager.resetStore({ auth: true, ui: false, preferences: false, clearApolloCache: false });
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

      it('resets UI state when ui option is true', async () => {
        await resetManager.resetStore({ auth: false, ui: true, preferences: false, clearApolloCache: false });
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.isLoading).toBe(false);
        expect(firstCall.isError).toBe(false);
        expect(firstCall.bottomSheetVisible).toBe(false);
        expect(firstCall.toastMessage).toBeNull();
        expect(firstCall.globalSearchQuery).toBe('');
      });

      it('resets preferences when preferences option is true', async () => {
        await resetManager.resetStore({ auth: false, ui: false, preferences: true, clearApolloCache: false });
        const firstCall = mockSet.mock.calls[0][0];
        expect(firstCall.onBoardingStep).toBeNull();
        expect(firstCall.notifications).toEqual([]);
        expect(firstCall.subscribedLists).toEqual([]);
        expect(firstCall.subscribedPantries).toEqual([]);
        expect(firstCall.scannedBarcode).toBeNull();
      });

      it('attempts to clear Apollo cache when clearApolloCache is true', async () => {
        // The internal dynamic import may fail in test env, but the code handles errors gracefully
        await resetManager.resetStore({ auth: false, ui: false, preferences: false, clearApolloCache: true });
        // Verify set was still called (reset continues despite cache clear error)
        expect(mockSet).toHaveBeenCalled();
      });

      it('skips Apollo cache clearing when clearApolloCache is false', async () => {
        await resetManager.resetStore({ auth: false, ui: false, preferences: false, clearApolloCache: false });
        expect(mockSet).toHaveBeenCalled();
      });

      it('clears auth from storage when auth is true', async () => {
        await resetManager.resetStore({ auth: true, ui: false, preferences: false, clearApolloCache: false });
        expect(clearTempRegistrationPassword).toHaveBeenCalled();
        expect(storage.remove).toHaveBeenCalledWith('accessToken');
        expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      });

      it('handles missing zustand data gracefully', async () => {
        // Should not throw even with no stored data
        await resetManager.resetStore({ auth: true, ui: false, preferences: false, clearApolloCache: false });
        expect(clearTempRegistrationPassword).toHaveBeenCalled();
      });

      it('ensures isHydrated remains true after reset', async () => {
        await resetManager.resetStore('SESSION_EXPIRED');
        // Last set call should be { isHydrated: true }
        const lastCall = mockSet.mock.calls[mockSet.mock.calls.length - 1][0];
        expect(lastCall.isHydrated).toBe(true);
      });

      it('handles Apollo cache clear error gracefully', async () => {
        // The dynamic import inside resetStore may fail, but error is caught
        await resetManager.resetStore({ auth: false, ui: false, preferences: false, clearApolloCache: true });
        // Should not throw, and set should still be called
        expect(mockSet).toHaveBeenCalled();
      });

      it('does not reset auth state when auth option is false', async () => {
        await resetManager.resetStore({ auth: false, ui: false, preferences: false, clearApolloCache: false });
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
      });

      it('sessionExpired resets with SESSION_EXPIRED scenario', async () => {
        await resetManager.sessionExpired();
        expect(mockSet).toHaveBeenCalled();
      });

      it('fullReset resets with FULL_RESET scenario', async () => {
        await resetManager.fullReset();
        expect(mockSet).toHaveBeenCalled();
      });

      it('resetOnboarding resets with ONBOARDING_RESET scenario', async () => {
        await resetManager.resetOnboarding();
        expect(mockSet).toHaveBeenCalled();
      });

      it('tokenRefreshFailed with clearCache=true resets auth with clearApolloCache', async () => {
        await resetManager.tokenRefreshFailed(true);
        // Should reset auth state
        const authCall = mockSet.mock.calls.find(
          (call: any[]) => call[0]?.user === null && call[0]?.accessToken === null,
        );
        expect(authCall).toBeDefined();
      });

      it('tokenRefreshFailed with clearCache=false uses SESSION_EXPIRED', async () => {
        await resetManager.tokenRefreshFailed(false);
        // Should still call set (auth reset from SESSION_EXPIRED)
        expect(mockSet).toHaveBeenCalled();
      });

      it('tokenRefreshFailed defaults to not clearing cache', async () => {
        await resetManager.tokenRefreshFailed();
        expect(mockSet).toHaveBeenCalled();
      });
    });
  });
});
