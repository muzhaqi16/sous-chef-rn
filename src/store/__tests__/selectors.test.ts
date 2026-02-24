import {
  selectUser,
  selectAccessToken,
  selectRefreshToken,
  selectSelectedHomeId,
  selectSelectedPantryId,
  selectSelectedShoppingListId,
  selectIsLoggedOut,
  selectIsLoggingOut,
  selectHydrated,
  selectAuthState,
  selectAuthTokens,
  selectNavigationState,
  selectIsOnline,
  selectIsHomeSelectionReady,
  selectHasInitializedHomeData,
} from '../useAppStore';

// Create a minimal mock state matching the RootState shape
function makeState(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', email: 'test@example.com', emailVerified: true, onBoarded: true },
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
