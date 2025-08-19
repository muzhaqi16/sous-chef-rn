import {RootState} from './index';
import {zustandStorage, STORAGE_KEY} from '#/storage/mmkv';

// Define what gets reset in different scenarios
export interface ResetOptions {
  auth?: boolean;
  preferences?: boolean;
  notifications?: boolean;
  scanner?: boolean;
  storage?: boolean;
}

// Predefined reset scenarios
export const RESET_SCENARIOS = {
  LOGOUT: {
    auth: true,
    preferences: false, // Keep user preferences like theme
    notifications: true,
    scanner: true,
    storage: false, // Don't clear storage completely, just auth data
  },
  FULL_RESET: {
    auth: true,
    preferences: true,
    notifications: true,
    scanner: true,
    storage: true,
  },
  SESSION_EXPIRED: {
    auth: true,
    preferences: false,
    notifications: false,
    scanner: true,
    storage: false,
  },
  ONBOARDING_RESET: {
    auth: false,
    preferences: true, // Reset onboarding state
    notifications: false,
    scanner: false,
    storage: false,
  },
} as const;

// Central reset manager
export const createResetManager = (
  set: (state: Partial<RootState>) => void,
  get: () => RootState,
) => ({
  // Master reset function
  resetStore: (options: ResetOptions | keyof typeof RESET_SCENARIOS) => {
    const resetOptions = typeof options === 'string' ? RESET_SCENARIOS[options] : options;
    const currentState = get();

    // Build the new state based on reset options
    const newState: Partial<RootState> = {};

    if (resetOptions.auth) {
      Object.assign(newState, getAuthResetState());
    }

    if (resetOptions.preferences) {
      Object.assign(newState, getPreferencesResetState(currentState));
    }

    if (resetOptions.notifications) {
      Object.assign(newState, getNotificationsResetState());
    }

    if (resetOptions.scanner) {
      Object.assign(newState, getScannerResetState());
    }

    // Handle storage reset
    if (resetOptions.storage) {
      zustandStorage.removeItem(STORAGE_KEY);
    } else if (resetOptions.auth) {
      // Only clear auth-related storage data
      clearAuthFromStorage();
    }

    // Apply the reset
    set(newState);

    // Ensure hydration flag remains true
    set({ isHydrated: true });
  },

  // Convenience methods for common scenarios
  logout: () => {
    const resetManager = createResetManager(set, get);
    resetManager.resetStore('LOGOUT');
  },

  fullReset: () => {
    const resetManager = createResetManager(set, get);
    resetManager.resetStore('FULL_RESET');
  },

  sessionExpired: () => {
    const resetManager = createResetManager(set, get);
    resetManager.resetStore('SESSION_EXPIRED');
  },

  resetOnboarding: () => {
    const resetManager = createResetManager(set, get);
    resetManager.resetStore('ONBOARDING_RESET');
  },
});

// Individual slice reset state getters
const getAuthResetState = () => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  pendingEmail: undefined,
  pendingPassword: undefined,
});

const getPreferencesResetState = (currentState: RootState) => ({
  // Reset onboarding state but keep user preferences like theme
  onBoardingStep: null,
  selectedHomeId: null,
  selectedPantryId: null,
  selectedShoppingListId: null,
  // Keep theme and language preferences
  theme: currentState.theme,
  language: currentState.language,
  emailNotifications: currentState.emailNotifications,
  pushNotifications: currentState.pushNotifications,
  rememberMe: currentState.rememberMe,
});

const getNotificationsResetState = () => ({
  notifications: [],
  unreadCount: 0,
  urgentCount: 0,
  lastFetchedAt: null,
  subscribedLists: [],
  subscribedPantries: [],
});

const getScannerResetState = () => ({
  scannedBarcode: null,
  isScanning: false,
  searchResults: [],
  isSearching: false,
  searchError: null,
  bottomSheetVisible: false,
  bottomSheetIndex: 0,
  recentlyScanned: [],
});

// Storage helpers
const clearAuthFromStorage = async () => {
  try {
    const currentData = await zustandStorage.getItem(STORAGE_KEY);
    if (currentData) {
      const parsedData = JSON.parse(currentData);
      delete parsedData.state.user;
      delete parsedData.state.accessToken;
      delete parsedData.state.refreshToken;
      delete parsedData.state.pendingEmail;
      delete parsedData.state.pendingPassword;
      zustandStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
    }
  } catch (error) {
    console.error('Error clearing auth from storage:', error);
  }
};