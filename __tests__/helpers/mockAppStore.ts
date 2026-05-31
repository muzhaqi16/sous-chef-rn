import type { RootState } from '#store/index';

/**
 * Creates a mock module for `jest.mock('#store/useAppStore', () => mockAppStore({...}))`.
 *
 * The returned object mirrors the real module shape: a `useAppStore` function that
 * applies the caller's selector to the provided state, plus hook functions that
 * return the appropriate slice of state.
 *
 * Usage:
 * ```ts
 * import { mockAppStore } from '#/test-utils/mockAppStore';
 * jest.mock('#store/useAppStore', () => mockAppStore({ user: { id: '1' }, isOnline: true }));
 * ```
 */
export function mockAppStore(state: Partial<RootState>) {
  const useAppStore: jest.Mock & {
    getState: () => Partial<RootState>;
    setState: jest.Mock;
    subscribe: jest.Mock;
  } = Object.assign(
    jest.fn(<T>(selector: (s: RootState) => T): T => selector(state as RootState)),
    {
      getState: jest.fn(() => state),
      setState: jest.fn(),
      subscribe: jest.fn(),
    },
  );

  return {
    useAppStore,

    // ── Atomic hooks ─────────────────────────────────────────────────────
    useUser: jest.fn(() => state.user),
    useSelectedHomeId: jest.fn(() => state.selectedHomeId),
    useSelectedPantryId: jest.fn(() => state.selectedPantryId),
    useSelectedShoppingListId: jest.fn(
      () => state.selectedShoppingListId,
    ),
    useIsLoggingOut: jest.fn(() => state.isLoggingOut),
    useIsHydrated: jest.fn(() => state.isHydrated),
    useIsOnline: jest.fn(() => state.isOnline),
    useCanAccessDevTools: jest.fn(
      () => state.user?.canAccessDevTools === true,
    ),
    useIsAdminUser: jest.fn(
      () =>
        state.user?.role === 'ADMIN' ||
        state.user?.role === 'SUPER_ADMIN',
    ),
    useIsHomeSelectionReady: jest.fn(
      () => state.isHomeSelectionReady,
    ),
    useSetIsHomeSelectionReady: jest.fn(
      () => state.setIsHomeSelectionReady,
    ),
    useSetIsPantryQueryComplete: jest.fn(
      () => state.setIsPantryQueryComplete,
    ),
    useSetHomeAndPantry: jest.fn(() => state.setHomeAndPantry),

    // ── Grouped hooks ────────────────────────────────────────────────────
    useAuthTokens: jest.fn(() => ({
      user: state.user,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      isAutoLoggingIn: state.isAutoLoggingIn,
      isLoggingOut: state.isLoggingOut,
    })),
    useAuthActions: jest.fn(() => ({
      setAuth: state.setAuth,
      clearAuth: state.clearAuth,
      setTokens: state.setTokens,
      updateUser: state.updateUser,
      setEmailVerified: state.setEmailVerified,
      setOnboarded: state.setOnboarded,
      setRememberMe: state.setRememberMe,
      setIsAutoLoggingIn: state.setIsAutoLoggingIn,
      setUserNavigationState: state.setUserNavigationState,
    })),
    usePostLoginState: jest.fn(() => ({
      navigationState: state.navigationState,
      showBiometricSetup: state.showBiometricSetup,
      postLoginCredentials: state.postLoginCredentials,
      setNavigationState: state.setNavigationState,
      setShowBiometricSetup: state.setShowBiometricSetup,
      setPostLoginCredentials: state.setPostLoginCredentials,
    })),
    useBottomSheetState: jest.fn(() => ({
      scannerSheetVisible: state.scannerSheetVisible,
      searchError: state.searchError,
      scannerSheetIndex: state.scannerSheetIndex,
      isSearching: state.isSearching,
      hideBottomSheet: state.hideBottomSheet,
      showBottomSheet: state.showBottomSheet,
    })),
    usePantryState: jest.fn(() => ({
      selectedPantryId: state.selectedPantryId,
      setSelectedPantryId: state.setSelectedPantryId,
      selectedHomeId: state.selectedHomeId,
      setSelectedHomeId: state.setSelectedHomeId,
    })),
    useShoppingListState: jest.fn(() => ({
      selectedShoppingListId: state.selectedShoppingListId,
      setSelectedShoppingListId: state.setSelectedShoppingListId,
    })),
    useHomeState: jest.fn(() => ({
      selectedHomeId: state.selectedHomeId,
      setSelectedHomeId: state.setSelectedHomeId,
    })),
    usePreferences: jest.fn(() => ({
      theme: state.theme,
      language: state.language,
      setTheme: state.setTheme,
      setLanguage: state.setLanguage,
    })),
    useNavigationUtils: jest.fn(() => ({
      getUserNavigationState: state.getUserNavigationState,
      setUserNavigationState: state.setUserNavigationState,
      setOnBoardingStep: state.setOnBoardingStep,
      setOnboarded: state.setOnboarded,
    })),
    useSearchState: jest.fn(() => ({
      searchResults: state.searchResults,
      isSearching: state.isSearching,
      searchError: state.searchError,
      setSearchResults: state.setSearchResults,
      setSearching: state.setSearching,
      setSearchError: state.setSearchError,
      clearSearch: state.clearSearch,
      addToRecentlyScanned: state.addToRecentlyScanned,
    })),
  };
}
