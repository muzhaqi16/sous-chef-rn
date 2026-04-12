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
  const useAppStore = jest.fn((selector: (s: any) => any) => selector(state));
  // Attach Zustand store API stubs for code that accesses useAppStore.getState()
  useAppStore.getState = jest.fn(() => state);
  useAppStore.setState = jest.fn();
  useAppStore.subscribe = jest.fn();

  return {
    useAppStore,

    // ── Atomic hooks ─────────────────────────────────────────────────────
    useUser: jest.fn(() => (state as any).user),
    useSelectedHomeId: jest.fn(() => (state as any).selectedHomeId),
    useSelectedPantryId: jest.fn(() => (state as any).selectedPantryId),
    useSelectedShoppingListId: jest.fn(
      () => (state as any).selectedShoppingListId,
    ),
    useIsLoggingOut: jest.fn(() => (state as any).isLoggingOut),
    useIsHydrated: jest.fn(() => (state as any).isHydrated),
    useIsOnline: jest.fn(() => (state as any).isOnline),
    useCanAccessDevTools: jest.fn(
      () => (state as any).user?.canAccessDevTools === true,
    ),
    useIsAdminUser: jest.fn(
      () =>
        (state as any).user?.role === 'ADMIN' ||
        (state as any).user?.role === 'SUPER_ADMIN',
    ),
    useIsHomeSelectionReady: jest.fn(
      () => (state as any).isHomeSelectionReady,
    ),
    useSetIsHomeSelectionReady: jest.fn(
      () => (state as any).setIsHomeSelectionReady,
    ),
    useSetIsPantryQueryComplete: jest.fn(
      () => (state as any).setIsPantryQueryComplete,
    ),
    useSetHomeAndPantry: jest.fn(() => (state as any).setHomeAndPantry),

    // ── Grouped hooks ────────────────────────────────────────────────────
    useAuthTokens: jest.fn(() => ({
      user: (state as any).user,
      accessToken: (state as any).accessToken,
      refreshToken: (state as any).refreshToken,
      isAutoLoggingIn: (state as any).isAutoLoggingIn,
      isLoggingOut: (state as any).isLoggingOut,
    })),
    useAuthActions: jest.fn(() => ({
      setAuth: (state as any).setAuth,
      clearAuth: (state as any).clearAuth,
      setTokens: (state as any).setTokens,
      updateUser: (state as any).updateUser,
      setEmailVerified: (state as any).setEmailVerified,
      setOnboarded: (state as any).setOnboarded,
      setRememberMe: (state as any).setRememberMe,
      setIsAutoLoggingIn: (state as any).setIsAutoLoggingIn,
      setUserNavigationState: (state as any).setUserNavigationState,
    })),
    usePostLoginState: jest.fn(() => ({
      navigationState: (state as any).navigationState,
      showBiometricSetup: (state as any).showBiometricSetup,
      postLoginCredentials: (state as any).postLoginCredentials,
      setNavigationState: (state as any).setNavigationState,
      setShowBiometricSetup: (state as any).setShowBiometricSetup,
      setPostLoginCredentials: (state as any).setPostLoginCredentials,
    })),
    useBottomSheetState: jest.fn(() => ({
      scannerSheetVisible: (state as any).scannerSheetVisible,
      searchError: (state as any).searchError,
      scannerSheetIndex: (state as any).scannerSheetIndex,
      isSearching: (state as any).isSearching,
      hideBottomSheet: (state as any).hideBottomSheet,
      showBottomSheet: (state as any).showBottomSheet,
    })),
    usePantryState: jest.fn(() => ({
      selectedPantryId: (state as any).selectedPantryId,
      setSelectedPantryId: (state as any).setSelectedPantryId,
      selectedHomeId: (state as any).selectedHomeId,
      setSelectedHomeId: (state as any).setSelectedHomeId,
    })),
    useShoppingListState: jest.fn(() => ({
      selectedShoppingListId: (state as any).selectedShoppingListId,
      setSelectedShoppingListId: (state as any).setSelectedShoppingListId,
    })),
    useHomeState: jest.fn(() => ({
      selectedHomeId: (state as any).selectedHomeId,
      setSelectedHomeId: (state as any).setSelectedHomeId,
    })),
    usePreferences: jest.fn(() => ({
      theme: (state as any).theme,
      language: (state as any).language,
      setTheme: (state as any).setTheme,
      setLanguage: (state as any).setLanguage,
    })),
    useNavigationUtils: jest.fn(() => ({
      getUserNavigationState: (state as any).getUserNavigationState,
      setUserNavigationState: (state as any).setUserNavigationState,
      setOnBoardingStep: (state as any).setOnBoardingStep,
      setOnboarded: (state as any).setOnboarded,
    })),
    useSearchState: jest.fn(() => ({
      searchResults: (state as any).searchResults,
      isSearching: (state as any).isSearching,
      searchError: (state as any).searchError,
      setSearchResults: (state as any).setSearchResults,
      setSearching: (state as any).setSearching,
      setSearchError: (state as any).setSearchError,
      clearSearch: (state as any).clearSearch,
      addToRecentlyScanned: (state as any).addToRecentlyScanned,
    })),
  };
}
