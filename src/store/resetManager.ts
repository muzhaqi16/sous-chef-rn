import { RootState } from './index';
import { zustandStorage, STORAGE_KEY } from '#/storage/mmkv';
import { storage } from '#/storage/mmkv';

// Simplified reset options
export interface ResetOptions {
  auth?: boolean;
  ui?: boolean;
  preferences?: boolean;
  clearApolloCache?: boolean;
}

// Simple reset scenarios
export const RESET_SCENARIOS = {
  LOGOUT: {
    auth: true,
    ui: true,
    preferences: false,
    clearApolloCache: true,
  },
  SESSION_EXPIRED: {
    auth: true,
    ui: false,
    preferences: false,
    clearApolloCache: false, // Preserve cache by default to support offline usage
  },
  FULL_RESET: {
    auth: true,
    ui: true,
    preferences: true,
    clearApolloCache: true,
  },
  ONBOARDING_RESET: {
    auth: false,
    ui: true,
    preferences: true,
    clearApolloCache: false,
  },
};

// Simplified reset manager
export const createResetManager = (
  set: (state: Partial<RootState>) => void,
  get: () => RootState,
) => ({
  resetStore: async (options: ResetOptions | keyof typeof RESET_SCENARIOS) => {
    const resetOptions =
      typeof options === 'string' ? RESET_SCENARIOS[options] : options;

    const newState: Partial<RootState> = {};

    // Reset auth state
    if (resetOptions.auth) {
      Object.assign(newState, {
        user: null,
        accessToken: null,
        refreshToken: null,
        pendingEmail: undefined,
        pendingPassword: undefined,
        // Clear navigation selections when auth is reset
        selectedHomeId: null,
        selectedPantryId: null,
        selectedShoppingListId: null,
        // Reset home data initialization flag to allow re-fetch on next login
        hasInitializedHomeData: false,
        // Reset home selection ready flag to prevent stale pantry queries on next login
        isHomeSelectionReady: false,
      });
    }

    // Reset UI state
    if (resetOptions.ui) {
      Object.assign(newState, {
        isLoading: false,
        isError: false,
        isFetching: false,
        bottomSheetVisible: false,
        bottomSheetIndex: 0,
        activeFormId: null,
        formData: {},
        globalSearchQuery: '',
        activeFilters: {},
        toastMessage: null,
        toastType: null,
      });
    }

    // Reset preferences (keep theme and language unless full reset)
    if (resetOptions.preferences) {
      Object.assign(newState, {
        // Reset onboarding state
        onBoardingStep: null,
        // Reset notifications
        notifications: [],
        unreadCount: 0,
        urgentCount: 0,
        subscribedLists: [],
        subscribedPantries: [],
        // Reset scanner state
        scannedBarcode: null,
        isScanning: false,
        searchResults: [],
        searchError: null,
        recentlyScanned: [],
      });
    }

    // Clear Apollo cache if requested
    if (resetOptions.clearApolloCache) {
      try {
        const { client } = await import('#/apollo/client');
        await client.clearStore();
        storage.remove('apollo-cache-1.0');
      } catch (error) {
        console.error('Error clearing Apollo cache:', error);
      }
    }

    // Clear auth storage
    if (resetOptions.auth) {
      await clearAuthFromStorage();
    }

    // Apply the reset
    set(newState);

    // Ensure hydration flag remains true
    set({ isHydrated: true });
  },

  // Convenience methods
  logout: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('LOGOUT');

    // Reset navigation state to auth after logout
    set({ navigationState: 'auth' });
  },

  sessionExpired: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('SESSION_EXPIRED');
  },

  fullReset: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('FULL_RESET');
  },

  resetOnboarding: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('ONBOARDING_RESET');
  },

  tokenRefreshFailed: async (clearCache: boolean = false) => {
    const resetManager = createResetManager(set, get);

    // If cache clearing is requested (e.g., for actual token expiration),
    // use a custom reset config that clears the cache
    if (clearCache) {
      await resetManager.resetStore({
        auth: true,
        ui: false,
        preferences: false,
        clearApolloCache: true,
      });
    } else {
      // Otherwise, preserve cache for offline usage
      await resetManager.resetStore('SESSION_EXPIRED');
    }
  },
});

// Simplified auth storage cleanup
const clearAuthFromStorage = async () => {
  try {
    // Note: We intentionally do NOT clear keychain credentials during logout
    // This allows users to use biometric login after logging out
    // Keychain credentials are only cleared during full reset or explicit user action

    // Clear individual auth-related keys
    storage.remove('accessToken');
    storage.remove('refreshToken');

    // Update persisted zustand data
    const currentData = await zustandStorage.getItem(STORAGE_KEY);
    if (currentData) {
      const parsedData = JSON.parse(currentData);
      if (parsedData.state) {
        // Clear auth-related fields only
        delete parsedData.state.user;
        delete parsedData.state.accessToken;
        delete parsedData.state.refreshToken;
        delete parsedData.state.pendingEmail;
        delete parsedData.state.pendingPassword;

        // Clear selected IDs
        delete parsedData.state.selectedHomeId;
        delete parsedData.state.selectedPantryId;
        delete parsedData.state.selectedShoppingListId;
        // Reset home data initialization flag
        delete parsedData.state.hasInitializedHomeData;
        // Reset home selection ready flag
        delete parsedData.state.isHomeSelectionReady;

        zustandStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
      }
    }
  } catch (error) {
    console.error('Error clearing auth from storage:', error);
  }
};
