import {
  selectUser,
  selectAccessToken,
  selectRefreshToken,
  selectSelectedHomeId,
  selectSelectedPantryId,
  selectSelectedShoppingListId,
  selectSelectedMealPlanId,
  selectIsLoggedOut,
  selectIsLoggingOut,
  selectHydrated,
  selectAuthState,
  selectAuthTokens,
  selectAuthActions,
  selectPostLoginState,
  selectNavigationState,
  selectIsOnline,
  selectIsHomeSelectionReady,
  selectHasInitializedHomeData,
  selectSetHasInitializedHomeData,
  selectSetIsHomeSelectionReady,
  selectIsPantryQueryComplete,
  selectSetIsPantryQueryComplete,
  selectBottomSheetState,
  selectSetters,
  selectPantryState,
  selectSetHomeAndPantry,
  selectShoppingListState,
  selectMealPlanState,
  selectHomeState,
  selectPreferences,
  selectTokenState,
  selectNavigationUtils,
  selectSearchState,
  selectIsAdminUser,
  selectCanAccessDevTools,
} from '../useAppStore';

// Create a minimal mock state matching the RootState shape
function makeState(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'u1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    selectedHomeId: 'home-1',
    selectedPantryId: 'pantry-1',
    selectedShoppingListId: 'list-1',
    isLoggingOut: false,
    isHydrated: true,
    isAutoLoggingIn: false,
    isOnline: true,
    hasInitializedHomeData: true,
    isHomeSelectionReady: true,
    ...overrides,
  } as any;
}

describe('primitive selectors', () => {
  it('selectUser returns user', () => {
    const state = makeState();
    expect(selectUser(state)).toEqual(state.user);
  });

  it('selectAccessToken returns accessToken', () => {
    expect(selectAccessToken(makeState())).toBe('access-token-123');
  });

  it('selectRefreshToken returns refreshToken', () => {
    expect(selectRefreshToken(makeState())).toBe('refresh-token-456');
  });

  it('selectSelectedHomeId returns selectedHomeId', () => {
    expect(selectSelectedHomeId(makeState())).toBe('home-1');
  });

  it('selectSelectedPantryId returns selectedPantryId', () => {
    expect(selectSelectedPantryId(makeState())).toBe('pantry-1');
  });

  it('selectSelectedShoppingListId returns selectedShoppingListId', () => {
    expect(selectSelectedShoppingListId(makeState())).toBe('list-1');
  });

  it('selectIsOnline returns isOnline', () => {
    expect(selectIsOnline(makeState())).toBe(true);
    expect(selectIsOnline(makeState({ isOnline: false }))).toBe(false);
  });

  it('selectHydrated returns isHydrated', () => {
    expect(selectHydrated(makeState())).toBe(true);
  });

  it('selectIsHomeSelectionReady returns flag', () => {
    expect(selectIsHomeSelectionReady(makeState())).toBe(true);
  });

  it('selectHasInitializedHomeData returns flag', () => {
    expect(selectHasInitializedHomeData(makeState())).toBe(true);
  });
});

describe('computed selectors', () => {
  it('selectIsLoggedOut returns true when no accessToken', () => {
    expect(selectIsLoggedOut(makeState({ accessToken: null }))).toBe(true);
  });

  it('selectIsLoggedOut returns false when accessToken exists', () => {
    expect(selectIsLoggedOut(makeState())).toBe(false);
  });

  it('selectIsLoggingOut returns isLoggingOut', () => {
    expect(selectIsLoggingOut(makeState())).toBe(false);
    expect(selectIsLoggingOut(makeState({ isLoggingOut: true }))).toBe(true);
  });
});

describe('grouped selectors', () => {
  it('selectAuthState returns grouped auth state', () => {
    const state = makeState();
    const result = selectAuthState(state);
    expect(result).toEqual({
      user: state.user,
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
    });
  });

  it('selectAuthTokens returns grouped auth tokens with loading flags', () => {
    const state = makeState();
    const result = selectAuthTokens(state);
    expect(result.user).toEqual(state.user);
    expect(result.accessToken).toBe('access-token-123');
    expect(result.refreshToken).toBe('refresh-token-456');
    expect(result.isAutoLoggingIn).toBe(false);
    expect(result.isLoggingOut).toBe(false);
  });

  it('selectNavigationState returns grouped navigation IDs', () => {
    const result = selectNavigationState(makeState());
    expect(result).toEqual({
      selectedHomeId: 'home-1',
      selectedPantryId: 'pantry-1',
      selectedShoppingListId: 'list-1',
    });
  });
});

describe('additional primitive selectors', () => {
  it('selectSelectedMealPlanId returns selectedMealPlanId', () => {
    expect(
      selectSelectedMealPlanId(makeState({ selectedMealPlanId: 'mp-1' })),
    ).toBe('mp-1');
  });

  it('selectSetHasInitializedHomeData returns setter', () => {
    const setter = jest.fn();
    expect(
      selectSetHasInitializedHomeData(
        makeState({ setHasInitializedHomeData: setter }),
      ),
    ).toBe(setter);
  });

  it('selectSetIsHomeSelectionReady returns setter', () => {
    const setter = jest.fn();
    expect(
      selectSetIsHomeSelectionReady(
        makeState({ setIsHomeSelectionReady: setter }),
      ),
    ).toBe(setter);
  });

  it('selectIsPantryQueryComplete returns flag', () => {
    expect(
      selectIsPantryQueryComplete(makeState({ isPantryQueryComplete: true })),
    ).toBe(true);
    expect(
      selectIsPantryQueryComplete(makeState({ isPantryQueryComplete: false })),
    ).toBe(false);
  });

  it('selectSetIsPantryQueryComplete returns setter', () => {
    const setter = jest.fn();
    expect(
      selectSetIsPantryQueryComplete(
        makeState({ setIsPantryQueryComplete: setter }),
      ),
    ).toBe(setter);
  });
});

describe('action and grouped selectors', () => {
  it('selectAuthActions returns all auth action functions', () => {
    const actions = {
      setAuth: jest.fn(),
      clearAuth: jest.fn(),
      setTokens: jest.fn(),
      updateUser: jest.fn(),
      setEmailVerified: jest.fn(),
      setOnboarded: jest.fn(),
      setRememberMe: jest.fn(),
      setIsAutoLoggingIn: jest.fn(),
      setUserNavigationState: jest.fn(),
    };
    const result = selectAuthActions(makeState(actions));
    expect(result.setAuth).toBe(actions.setAuth);
    expect(result.clearAuth).toBe(actions.clearAuth);
    expect(result.setTokens).toBe(actions.setTokens);
    expect(result.updateUser).toBe(actions.updateUser);
    expect(result.setEmailVerified).toBe(actions.setEmailVerified);
    expect(result.setOnboarded).toBe(actions.setOnboarded);
    expect(result.setRememberMe).toBe(actions.setRememberMe);
    expect(result.setIsAutoLoggingIn).toBe(actions.setIsAutoLoggingIn);
    expect(result.setUserNavigationState).toBe(actions.setUserNavigationState);
  });

  it('selectPostLoginState returns grouped post-login state', () => {
    const overrides = {
      navigationState: 'HOME',
      showBiometricSetup: true,
      postLoginCredentials: { email: 'a@b.com' },
      setNavigationState: jest.fn(),
      setShowBiometricSetup: jest.fn(),
      setPostLoginCredentials: jest.fn(),
    };
    const result = selectPostLoginState(makeState(overrides));
    expect(result.navigationState).toBe('HOME');
    expect(result.showBiometricSetup).toBe(true);
    expect(result.postLoginCredentials).toEqual({ email: 'a@b.com' });
    expect(result.setNavigationState).toBe(overrides.setNavigationState);
    expect(result.setShowBiometricSetup).toBe(overrides.setShowBiometricSetup);
    expect(result.setPostLoginCredentials).toBe(
      overrides.setPostLoginCredentials,
    );
  });

  it('selectBottomSheetState returns scanner bottom sheet state', () => {
    const overrides = {
      scannerSheetVisible: true,
      searchError: 'err',
      scannerSheetIndex: 1,
      isSearching: true,
      hideBottomSheet: jest.fn(),
      showBottomSheet: jest.fn(),
    };
    const result = selectBottomSheetState(makeState(overrides));
    expect(result.scannerSheetVisible).toBe(true);
    expect(result.searchError).toBe('err');
    expect(result.scannerSheetIndex).toBe(1);
    expect(result.isSearching).toBe(true);
    expect(result.hideBottomSheet).toBe(overrides.hideBottomSheet);
    expect(result.showBottomSheet).toBe(overrides.showBottomSheet);
  });

  it('selectSetters returns all setter functions', () => {
    const setters = {
      updateUser: jest.fn(),
      setTokens: jest.fn(),
      setSelectedHomeId: jest.fn(),
      setSelectedPantryId: jest.fn(),
      setSelectedShoppingListId: jest.fn(),
      logout: jest.fn(),
    };
    const result = selectSetters(makeState(setters));
    expect(result.updateUser).toBe(setters.updateUser);
    expect(result.setSelectedHomeId).toBe(setters.setSelectedHomeId);
    expect(result.logout).toBe(setters.logout);
  });

  it('selectPantryState returns pantry-related state', () => {
    const overrides = {
      selectedPantryId: 'p-1',
      setSelectedPantryId: jest.fn(),
      selectedHomeId: 'h-1',
      setSelectedHomeId: jest.fn(),
    };
    const result = selectPantryState(makeState(overrides));
    expect(result.selectedPantryId).toBe('p-1');
    expect(result.setSelectedPantryId).toBe(overrides.setSelectedPantryId);
    expect(result.selectedHomeId).toBe('h-1');
  });

  it('selectSetHomeAndPantry returns the atomic setter', () => {
    const setter = jest.fn();
    expect(
      selectSetHomeAndPantry(makeState({ setHomeAndPantry: setter })),
    ).toBe(setter);
  });

  it('selectShoppingListState returns shopping list state', () => {
    const overrides = {
      selectedShoppingListId: 'sl-1',
      setSelectedShoppingListId: jest.fn(),
    };
    const result = selectShoppingListState(makeState(overrides));
    expect(result.selectedShoppingListId).toBe('sl-1');
    expect(result.setSelectedShoppingListId).toBe(
      overrides.setSelectedShoppingListId,
    );
  });

  it('selectMealPlanState returns meal plan state', () => {
    const overrides = {
      selectedMealPlanId: 'mp-1',
      setSelectedMealPlanId: jest.fn(),
    };
    const result = selectMealPlanState(makeState(overrides));
    expect(result.selectedMealPlanId).toBe('mp-1');
    expect(result.setSelectedMealPlanId).toBe(overrides.setSelectedMealPlanId);
  });

  it('selectHomeState returns home state', () => {
    const overrides = {
      selectedHomeId: 'h-1',
      setSelectedHomeId: jest.fn(),
    };
    const result = selectHomeState(makeState(overrides));
    expect(result.selectedHomeId).toBe('h-1');
    expect(result.setSelectedHomeId).toBe(overrides.setSelectedHomeId);
  });

  it('selectPreferences returns theme and language', () => {
    const overrides = {
      theme: 'dark',
      language: 'en',
      setTheme: jest.fn(),
      setLanguage: jest.fn(),
    };
    const result = selectPreferences(makeState(overrides));
    expect(result.theme).toBe('dark');
    expect(result.language).toBe('en');
    expect(result.setTheme).toBe(overrides.setTheme);
    expect(result.setLanguage).toBe(overrides.setLanguage);
  });

  it('selectTokenState returns token state', () => {
    const result = selectTokenState(makeState());
    expect(result.accessToken).toBe('access-token-123');
    expect(result.refreshToken).toBe('refresh-token-456');
  });

  it('selectNavigationUtils returns navigation utility functions', () => {
    const overrides = {
      getUserNavigationState: jest.fn(),
      setUserNavigationState: jest.fn(),
      setOnBoardingStep: jest.fn(),
      setOnboarded: jest.fn(),
    };
    const result = selectNavigationUtils(makeState(overrides));
    expect(result.getUserNavigationState).toBe(
      overrides.getUserNavigationState,
    );
    expect(result.setOnBoardingStep).toBe(overrides.setOnBoardingStep);
  });

  it('selectSearchState returns search state', () => {
    const overrides = {
      searchResults: ['r1'],
      isSearching: false,
      searchError: null,
      setSearchResults: jest.fn(),
      setSearching: jest.fn(),
      setSearchError: jest.fn(),
      clearSearch: jest.fn(),
      addToRecentlyScanned: jest.fn(),
    };
    const result = selectSearchState(makeState(overrides));
    expect(result.searchResults).toEqual(['r1']);
    expect(result.isSearching).toBe(false);
    expect(result.clearSearch).toBe(overrides.clearSearch);
  });

  it('selectIsAdminUser returns true for ADMIN role', () => {
    expect(selectIsAdminUser(makeState({ user: { role: 'ADMIN' } }))).toBe(
      true,
    );
  });

  it('selectIsAdminUser returns true for SUPER_ADMIN role', () => {
    expect(
      selectIsAdminUser(makeState({ user: { role: 'SUPER_ADMIN' } })),
    ).toBe(true);
  });

  it('selectIsAdminUser returns false for regular user', () => {
    expect(selectIsAdminUser(makeState({ user: { role: 'MEMBER' } }))).toBe(
      false,
    );
  });

  it('selectIsAdminUser returns false when user is null', () => {
    expect(selectIsAdminUser(makeState({ user: null }))).toBeFalsy();
  });

  it('selectCanAccessDevTools returns true when canAccessDevTools is true', () => {
    expect(
      selectCanAccessDevTools(makeState({ user: { canAccessDevTools: true } })),
    ).toBe(true);
  });

  it('selectCanAccessDevTools returns false when canAccessDevTools is false', () => {
    expect(
      selectCanAccessDevTools(
        makeState({ user: { canAccessDevTools: false } }),
      ),
    ).toBe(false);
  });

  it('selectCanAccessDevTools returns false when canAccessDevTools is undefined', () => {
    expect(selectCanAccessDevTools(makeState({ user: { id: 'u1' } }))).toBe(
      false,
    );
  });

  it('selectCanAccessDevTools returns false when user is null', () => {
    expect(selectCanAccessDevTools(makeState({ user: null }))).toBeFalsy();
  });
});
