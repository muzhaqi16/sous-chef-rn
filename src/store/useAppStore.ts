import { useStore, RootState } from './index';

/**
 * Typed selector hook for Zustand store
 *
 * Usage:
 * ```tsx
 * // Instead of:
 * const { user, accessToken } = useStore();  // ❌ Re-renders on ANY state change
 *
 * // Do this:
 * const user = useAppStore(state => state.user);  // ✅ Only re-renders when user changes
 * const accessToken = useAppStore(state => state.accessToken);  // ✅ Only re-renders when accessToken changes
 * ```
 *
 * With equality function for complex objects:
 * ```tsx
 * import { shallow } from 'zustand/shallow';
 *
 * const homeState = useAppStore(
 *   state => ({ homeId: state.selectedHomeId, pantryId: state.selectedPantryId }),
 *   shallow
 * );
 * ```
 */
export function useAppStore<T>(
  selector: (state: RootState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  // Zustand's useStore supports an optional equality function as second parameter
  // Cast to any to work around TypeScript middleware type inference limitations
  return (useStore as any)(selector, equalityFn);
}

// Common selectors for frequently accessed state
export const selectUser = (state: RootState) => state.user;
export const selectAccessToken = (state: RootState) => state.accessToken;
export const selectRefreshToken = (state: RootState) => state.refreshToken;
export const selectSelectedHomeId = (state: RootState) => state.selectedHomeId;
export const selectSelectedPantryId = (state: RootState) => state.selectedPantryId;
export const selectSelectedShoppingListId = (state: RootState) => state.selectedShoppingListId;
export const selectIsLoggedOut = (state: RootState) => !state.accessToken;
export const selectIsLoggingOut = (state: RootState) => state.isLoggingOut;
export const selectHydrated = (state: RootState) => state.isHydrated;

// Auth-related selectors
export const selectAuthState = (state: RootState) => ({
  user: state.user,
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
});

// PERFORMANCE: Grouped auth state selector for useAuthState hook
// Reduces 16+ individual subscriptions to 3 grouped subscriptions
export const selectAuthTokens = (state: RootState) => ({
  user: state.user,
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
  isAutoLoggingIn: state.isAutoLoggingIn,
  isLoggingOut: state.isLoggingOut,
});

export const selectAuthActions = (state: RootState) => ({
  setAuth: state.setAuth,
  clearAuth: state.clearAuth,
  setTokens: state.setTokens,
  updateUser: state.updateUser,
  setEmailVerified: state.setEmailVerified,
  setOnboarded: state.setOnboarded,
  setRememberMe: state.setRememberMe,
  setIsAutoLoggingIn: state.setIsAutoLoggingIn,
  setUserNavigationState: state.setUserNavigationState,
});

export const selectPostLoginState = (state: RootState) => ({
  navigationState: state.navigationState,
  showBiometricSetup: state.showBiometricSetup,
  postLoginCredentials: state.postLoginCredentials,
  setNavigationState: state.setNavigationState,
  setShowBiometricSetup: state.setShowBiometricSetup,
  setPostLoginCredentials: state.setPostLoginCredentials,
});

// Navigation-related selectors
export const selectNavigationState = (state: RootState) => ({
  selectedHomeId: state.selectedHomeId,
  selectedPantryId: state.selectedPantryId,
  selectedShoppingListId: state.selectedShoppingListId,
});

// PERFORMANCE: Scanner bottom sheet state selector for SearchResultsScreen
// Reduces 6 individual subscriptions to 1 grouped subscription
export const selectBottomSheetState = (state: RootState) => ({
  scannerSheetVisible: state.scannerSheetVisible,
  searchError: state.searchError,
  scannerSheetIndex: state.scannerSheetIndex,
  isSearching: state.isSearching,
  hideBottomSheet: state.hideBottomSheet,
  showBottomSheet: state.showBottomSheet,
});

// Actions (non-selector exports for setting state)
export const selectSetters = (state: RootState) => ({
  updateUser: state.updateUser,
  setTokens: state.setTokens,
  setSelectedHomeId: state.setSelectedHomeId,
  setSelectedPantryId: state.setSelectedPantryId,
  setSelectedShoppingListId: state.setSelectedShoppingListId,
  logout: state.logout,
});

// PERFORMANCE: Pantry state selector - reduces multiple subscriptions to 1
export const selectPantryState = (state: RootState) => ({
  selectedPantryId: state.selectedPantryId,
  setSelectedPantryId: state.setSelectedPantryId,
  selectedHomeId: state.selectedHomeId,
  setSelectedHomeId: state.setSelectedHomeId,
});

// Atomic home+pantry action selector - prevents race conditions during home switch
export const selectSetHomeAndPantry = (state: RootState) => state.setHomeAndPantry;

// PERFORMANCE: Shopping list state selector - reduces multiple subscriptions to 1
// Note: selectedHomeId removed - shopping lists are independent of homes
export const selectShoppingListState = (state: RootState) => ({
  selectedShoppingListId: state.selectedShoppingListId,
  setSelectedShoppingListId: state.setSelectedShoppingListId,
});

// PERFORMANCE: Home state selector - reduces multiple subscriptions to 1
export const selectHomeState = (state: RootState) => ({
  selectedHomeId: state.selectedHomeId,
  setSelectedHomeId: state.setSelectedHomeId,
});

// Home initialization flag selector (for useDefaultHome)
export const selectHasInitializedHomeData = (state: RootState) => state.hasInitializedHomeData;
export const selectSetHasInitializedHomeData = (state: RootState) => state.setHasInitializedHomeData;

// Home selection ready flag selectors - gates pantry queries until home selection is complete
export const selectIsHomeSelectionReady = (state: RootState) => state.isHomeSelectionReady;
export const selectSetIsHomeSelectionReady = (state: RootState) => state.setIsHomeSelectionReady;

// PERFORMANCE: Theme/preferences selector - reduces multiple subscriptions to 1
export const selectPreferences = (state: RootState) => ({
  theme: state.theme,
  language: state.language,
  setTheme: state.setTheme,
  setLanguage: state.setLanguage,
});

// PERFORMANCE: Token manager selector - reduces multiple subscriptions to 1
export const selectTokenState = (state: RootState) => ({
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
  setTokens: state.setTokens,
});

// PERFORMANCE: Navigation utilities selector - for getUserNavigationState usage
export const selectNavigationUtils = (state: RootState) => ({
  getUserNavigationState: state.getUserNavigationState,
  setUserNavigationState: state.setUserNavigationState,
  setOnBoardingStep: state.setOnBoardingStep,
  setOnboarded: state.setOnboarded,
});

// PERFORMANCE: Search state selector - comprehensive search functionality
export const selectSearchState = (state: RootState) => ({
  searchResults: state.searchResults,
  isSearching: state.isSearching,
  searchError: state.searchError,
  setSearchResults: state.setSearchResults,
  setSearching: state.setSearching,
  setSearchError: state.setSearchError,
  clearSearch: state.clearSearch,
  addToRecentlyScanned: state.addToRecentlyScanned,
});

// Single property selector for network status
export const selectIsOnline = (state: RootState) => state.isOnline;
