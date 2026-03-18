import type { RootState } from '#store/index';

/**
 * Creates a mock module for `jest.mock('#store/useAppStore', () => mockAppStore({...}))`.
 *
 * The returned object mirrors the real module shape: a `useAppStore` function that
 * applies the caller's selector to the provided state, plus re-exported selector functions.
 *
 * Usage:
 * ```ts
 * import { mockAppStore } from '#/test-utils/mockAppStore';
 * jest.mock('#store/useAppStore', () => mockAppStore({ user: { id: '1' }, isOnline: true }));
 * ```
 */
export function mockAppStore(state: Partial<RootState>) {
  const useAppStore = jest.fn((selector: (s: any) => any) => selector(state));
  // Attach Zustand store API stubs for code that accesses useAppStore.getState()
  useAppStore.getState = jest.fn(() => state);
  useAppStore.setState = jest.fn();
  useAppStore.subscribe = jest.fn();

  return {
    useAppStore,
    // Re-export common selectors as identity functions so code using them still works
    selectUser: (s: any) => s.user,
    selectAccessToken: (s: any) => s.accessToken,
    selectRefreshToken: (s: any) => s.refreshToken,
    selectSelectedHomeId: (s: any) => s.selectedHomeId,
    selectSelectedPantryId: (s: any) => s.selectedPantryId,
    selectSelectedShoppingListId: (s: any) => s.selectedShoppingListId,
    selectSelectedMealPlanId: (s: any) => s.selectedMealPlanId,
    selectIsLoggedOut: (s: any) => !s.accessToken,
    selectIsLoggingOut: (s: any) => s.isLoggingOut,
    selectHydrated: (s: any) => s.isHydrated,
    selectAuthState: (s: any) => ({
      user: s.user,
      accessToken: s.accessToken,
      refreshToken: s.refreshToken,
    }),
    selectAuthTokens: (s: any) => ({
      user: s.user,
      accessToken: s.accessToken,
      refreshToken: s.refreshToken,
      isAutoLoggingIn: s.isAutoLoggingIn,
      isLoggingOut: s.isLoggingOut,
    }),
    selectAuthActions: (s: any) => ({
      setAuth: s.setAuth,
      clearAuth: s.clearAuth,
      setTokens: s.setTokens,
      updateUser: s.updateUser,
      setEmailVerified: s.setEmailVerified,
      setOnboarded: s.setOnboarded,
      setRememberMe: s.setRememberMe,
      setIsAutoLoggingIn: s.setIsAutoLoggingIn,
      setUserNavigationState: s.setUserNavigationState,
    }),
    selectPostLoginState: (s: any) => ({
      navigationState: s.navigationState,
      showBiometricSetup: s.showBiometricSetup,
      postLoginCredentials: s.postLoginCredentials,
      setNavigationState: s.setNavigationState,
      setShowBiometricSetup: s.setShowBiometricSetup,
      setPostLoginCredentials: s.setPostLoginCredentials,
    }),
    selectNavigationState: (s: any) => ({
      selectedHomeId: s.selectedHomeId,
      selectedPantryId: s.selectedPantryId,
      selectedShoppingListId: s.selectedShoppingListId,
    }),
    selectBottomSheetState: (s: any) => ({
      scannerSheetVisible: s.scannerSheetVisible,
      searchError: s.searchError,
      scannerSheetIndex: s.scannerSheetIndex,
      isSearching: s.isSearching,
      hideBottomSheet: s.hideBottomSheet,
      showBottomSheet: s.showBottomSheet,
    }),
    selectSetters: (s: any) => ({
      updateUser: s.updateUser,
      setTokens: s.setTokens,
      setSelectedHomeId: s.setSelectedHomeId,
      setSelectedPantryId: s.setSelectedPantryId,
      setSelectedShoppingListId: s.setSelectedShoppingListId,
      logout: s.logout,
    }),
    selectPantryState: (s: any) => ({
      selectedPantryId: s.selectedPantryId,
      setSelectedPantryId: s.setSelectedPantryId,
      selectedHomeId: s.selectedHomeId,
      setSelectedHomeId: s.setSelectedHomeId,
    }),
    selectSetHomeAndPantry: (s: any) => s.setHomeAndPantry,
    selectShoppingListState: (s: any) => ({
      selectedShoppingListId: s.selectedShoppingListId,
      setSelectedShoppingListId: s.setSelectedShoppingListId,
    }),
    selectMealPlanState: (s: any) => ({
      selectedMealPlanId: s.selectedMealPlanId,
      setSelectedMealPlanId: s.setSelectedMealPlanId,
    }),
    selectHomeState: (s: any) => ({
      selectedHomeId: s.selectedHomeId,
      setSelectedHomeId: s.setSelectedHomeId,
    }),
    selectHasInitializedHomeData: (s: any) => s.hasInitializedHomeData,
    selectSetHasInitializedHomeData: (s: any) => s.setHasInitializedHomeData,
    selectIsHomeSelectionReady: (s: any) => s.isHomeSelectionReady,
    selectSetIsHomeSelectionReady: (s: any) => s.setIsHomeSelectionReady,
    selectIsPantryQueryComplete: (s: any) => s.isPantryQueryComplete,
    selectSetIsPantryQueryComplete: (s: any) => s.setIsPantryQueryComplete,
    selectPreferences: (s: any) => ({
      theme: s.theme,
      language: s.language,
      setTheme: s.setTheme,
      setLanguage: s.setLanguage,
    }),
    selectTokenState: (s: any) => ({
      accessToken: s.accessToken,
      refreshToken: s.refreshToken,
      setTokens: s.setTokens,
    }),
    selectNavigationUtils: (s: any) => ({
      getUserNavigationState: s.getUserNavigationState,
      setUserNavigationState: s.setUserNavigationState,
      setOnBoardingStep: s.setOnBoardingStep,
      setOnboarded: s.setOnboarded,
    }),
    selectSearchState: (s: any) => ({
      searchResults: s.searchResults,
      isSearching: s.isSearching,
      searchError: s.searchError,
      setSearchResults: s.setSearchResults,
      setSearching: s.setSearching,
      setSearchError: s.setSearchError,
      clearSearch: s.clearSearch,
      addToRecentlyScanned: s.addToRecentlyScanned,
    }),
    selectIsAdminUser: (s: any) =>
      s.user?.role === 'ADMIN' || s.user?.role === 'SUPER_ADMIN',
    selectCanAccessDevTools: (s: any) =>
      s.user?.canAccessDevTools === true,
    selectIsOnline: (s: any) => s.isOnline,
  };
}
