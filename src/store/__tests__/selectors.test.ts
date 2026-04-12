import { renderHook } from '@testing-library/react-native';
import {
  useUser,
  useSelectedHomeId,
  useSelectedPantryId,
  useSelectedShoppingListId,
  useIsLoggingOut,
  useIsHydrated,
  useIsOnline,
  useIsHomeSelectionReady,
  useIsAdminUser,
  useCanAccessDevTools,
  useAuthTokens,
  useAuthActions,
  usePostLoginState,
  useBottomSheetState,
  usePantryState,
  useShoppingListState,
  useHomeState,
  usePreferences,
  useNavigationUtils,
  useSearchState,
  useSetHomeAndPantry,
  useSetIsHomeSelectionReady,
  useSetIsPantryQueryComplete,
} from '../useAppStore';

// Mock state
const mockState: Record<string, unknown> = {
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
  isHomeSelectionReady: true,
  setHomeAndPantry: jest.fn(),
  setIsHomeSelectionReady: jest.fn(),
  setIsPantryQueryComplete: jest.fn(),
  // Actions for grouped selectors
  setAuth: jest.fn(),
  clearAuth: jest.fn(),
  setTokens: jest.fn(),
  updateUser: jest.fn(),
  setEmailVerified: jest.fn(),
  setOnboarded: jest.fn(),
  setRememberMe: jest.fn(),
  setIsAutoLoggingIn: jest.fn(),
  setUserNavigationState: jest.fn(),
  navigationState: 'main_app',
  showBiometricSetup: false,
  postLoginCredentials: null,
  setNavigationState: jest.fn(),
  setShowBiometricSetup: jest.fn(),
  setPostLoginCredentials: jest.fn(),
  scannerSheetVisible: false,
  searchError: null,
  scannerSheetIndex: 0,
  isSearching: false,
  hideBottomSheet: jest.fn(),
  showBottomSheet: jest.fn(),
  setSelectedPantryId: jest.fn(),
  setSelectedHomeId: jest.fn(),
  setSelectedShoppingListId: jest.fn(),
  theme: 'LIGHT',
  language: 'en',
  setTheme: jest.fn(),
  setLanguage: jest.fn(),
  getUserNavigationState: jest.fn(),
  setOnBoardingStep: jest.fn(),
  searchResults: [],
  setSearchResults: jest.fn(),
  setSearching: jest.fn(),
  setSearchError: jest.fn(),
  clearSearch: jest.fn(),
  addToRecentlyScanned: jest.fn(),
};

// Mock the store module so hooks read from mockState
jest.mock('../index', () => ({
  storeApi: {
    getState: () => mockState,
    subscribe: jest.fn(() => jest.fn()),
    getInitialState: () => mockState,
  },
}));

function updateMockState(overrides: Record<string, unknown>) {
  Object.assign(mockState, overrides);
}

afterEach(() => {
  // Reset any state overrides after each test
  updateMockState({
    user: {
      id: 'u1',
      email: 'test@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isLoggingOut: false,
    isOnline: true,
    isHomeSelectionReady: true,
  });
});

describe('atomic hooks', () => {
  it('useUser returns user', () => {
    const { result } = renderHook(() => useUser());
    expect(result.current).toEqual(mockState.user);
  });

  it('useSelectedHomeId returns selectedHomeId', () => {
    const { result } = renderHook(() => useSelectedHomeId());
    expect(result.current).toBe('home-1');
  });

  it('useSelectedPantryId returns selectedPantryId', () => {
    const { result } = renderHook(() => useSelectedPantryId());
    expect(result.current).toBe('pantry-1');
  });

  it('useSelectedShoppingListId returns selectedShoppingListId', () => {
    const { result } = renderHook(() => useSelectedShoppingListId());
    expect(result.current).toBe('list-1');
  });

  it('useIsOnline returns isOnline', () => {
    const { result } = renderHook(() => useIsOnline());
    expect(result.current).toBe(true);
  });

  it('useIsHydrated returns isHydrated', () => {
    const { result } = renderHook(() => useIsHydrated());
    expect(result.current).toBe(true);
  });

  it('useIsLoggingOut returns isLoggingOut', () => {
    const { result } = renderHook(() => useIsLoggingOut());
    expect(result.current).toBe(false);
  });

  it('useIsHomeSelectionReady returns flag', () => {
    const { result } = renderHook(() => useIsHomeSelectionReady());
    expect(result.current).toBe(true);
  });

  it('useSetHomeAndPantry returns setter', () => {
    const { result } = renderHook(() => useSetHomeAndPantry());
    expect(result.current).toBe(mockState.setHomeAndPantry);
  });

  it('useSetIsHomeSelectionReady returns setter', () => {
    const { result } = renderHook(() => useSetIsHomeSelectionReady());
    expect(result.current).toBe(mockState.setIsHomeSelectionReady);
  });

  it('useSetIsPantryQueryComplete returns setter', () => {
    const { result } = renderHook(() => useSetIsPantryQueryComplete());
    expect(result.current).toBe(mockState.setIsPantryQueryComplete);
  });
});

describe('computed hooks', () => {
  it('useIsAdminUser returns true for ADMIN role', () => {
    updateMockState({ user: { role: 'ADMIN' } });
    const { result } = renderHook(() => useIsAdminUser());
    expect(result.current).toBe(true);
  });

  it('useIsAdminUser returns true for SUPER_ADMIN role', () => {
    updateMockState({ user: { role: 'SUPER_ADMIN' } });
    const { result } = renderHook(() => useIsAdminUser());
    expect(result.current).toBe(true);
  });

  it('useIsAdminUser returns false for regular user', () => {
    updateMockState({ user: { role: 'MEMBER' } });
    const { result } = renderHook(() => useIsAdminUser());
    expect(result.current).toBe(false);
  });

  it('useIsAdminUser returns false when user is null', () => {
    updateMockState({ user: null });
    const { result } = renderHook(() => useIsAdminUser());
    expect(result.current).toBeFalsy();
  });

  it('useCanAccessDevTools returns true when canAccessDevTools is true', () => {
    updateMockState({ user: { canAccessDevTools: true } });
    const { result } = renderHook(() => useCanAccessDevTools());
    expect(result.current).toBe(true);
  });

  it('useCanAccessDevTools returns false when canAccessDevTools is false', () => {
    updateMockState({ user: { canAccessDevTools: false } });
    const { result } = renderHook(() => useCanAccessDevTools());
    expect(result.current).toBe(false);
  });

  it('useCanAccessDevTools returns false when user is null', () => {
    updateMockState({ user: null });
    const { result } = renderHook(() => useCanAccessDevTools());
    expect(result.current).toBeFalsy();
  });
});

describe('grouped hooks', () => {
  it('useAuthTokens returns grouped auth tokens with loading flags', () => {
    const { result } = renderHook(() => useAuthTokens());
    expect(result.current.user).toEqual(mockState.user);
    expect(result.current.accessToken).toBe('access-token-123');
    expect(result.current.refreshToken).toBe('refresh-token-456');
    expect(result.current.isAutoLoggingIn).toBe(false);
    expect(result.current.isLoggingOut).toBe(false);
  });

  it('useAuthActions returns all auth action functions', () => {
    const { result } = renderHook(() => useAuthActions());
    expect(result.current.setAuth).toBe(mockState.setAuth);
    expect(result.current.clearAuth).toBe(mockState.clearAuth);
    expect(result.current.setTokens).toBe(mockState.setTokens);
    expect(result.current.updateUser).toBe(mockState.updateUser);
  });

  it('usePostLoginState returns grouped post-login state', () => {
    const { result } = renderHook(() => usePostLoginState());
    expect(result.current.navigationState).toBe('main_app');
    expect(result.current.showBiometricSetup).toBe(false);
    expect(result.current.setNavigationState).toBe(
      mockState.setNavigationState,
    );
  });

  it('useBottomSheetState returns scanner bottom sheet state', () => {
    const { result } = renderHook(() => useBottomSheetState());
    expect(result.current.scannerSheetVisible).toBe(false);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.hideBottomSheet).toBe(mockState.hideBottomSheet);
  });

  it('usePantryState returns pantry-related state', () => {
    const { result } = renderHook(() => usePantryState());
    expect(result.current.selectedPantryId).toBe('pantry-1');
    expect(result.current.selectedHomeId).toBe('home-1');
    expect(result.current.setSelectedPantryId).toBe(
      mockState.setSelectedPantryId,
    );
  });

  it('useShoppingListState returns shopping list state', () => {
    const { result } = renderHook(() => useShoppingListState());
    expect(result.current.selectedShoppingListId).toBe('list-1');
  });

  it('useHomeState returns home state', () => {
    const { result } = renderHook(() => useHomeState());
    expect(result.current.selectedHomeId).toBe('home-1');
    expect(result.current.setSelectedHomeId).toBe(mockState.setSelectedHomeId);
  });

  it('usePreferences returns theme and language', () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.theme).toBe('LIGHT');
    expect(result.current.language).toBe('en');
    expect(result.current.setTheme).toBe(mockState.setTheme);
  });

  it('useNavigationUtils returns navigation utility functions', () => {
    const { result } = renderHook(() => useNavigationUtils());
    expect(result.current.getUserNavigationState).toBe(
      mockState.getUserNavigationState,
    );
    expect(result.current.setOnBoardingStep).toBe(mockState.setOnBoardingStep);
  });

  it('useSearchState returns search state', () => {
    const { result } = renderHook(() => useSearchState());
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.clearSearch).toBe(mockState.clearSearch);
  });
});
