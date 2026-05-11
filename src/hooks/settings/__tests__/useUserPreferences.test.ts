import { renderHook, act } from '@testing-library/react-native';
import {
  useUserPreferences,
  useShowShoppingListImages,
} from '../useUserPreferences';
import { defaultUserPreferences } from '#/store/slices/preferencesSlice';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockSetUserPreference = jest.fn();
const mockResetUserPreferences = jest.fn();

let mockUserId: string | undefined = 'u1';
let mockUserPreferencesMap: Record<string, any> = {};

jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    user: mockUserId ? { id: mockUserId } : null,
    userPreferences: mockUserPreferencesMap,
    setUserPreference: mockSetUserPreference,
    resetUserPreferences: mockResetUserPreferences,
  });
  return {
    useAppStore: (selector: (state: any) => any) => selector(getState()),
    useUser: () => (s => s.user)(getState()),
    useUserId: () => (s => s.user?.id)(getState()),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'u1';
  mockUserPreferencesMap = {};
});

describe('useUserPreferences (settings)', () => {
  it('returns default preferences when no preferences set for user', () => {
    const { result } = renderHook(() => useUserPreferences());
    expect(result.current.preferences).toEqual(defaultUserPreferences);
  });

  it('returns stored preferences for the current user', () => {
    mockUserPreferencesMap = {
      u1: { showShoppingListImages: false },
    };
    const { result } = renderHook(() => useUserPreferences());
    expect(result.current.preferences).toEqual({
      showShoppingListImages: false,
    });
  });

  it('returns default preferences when no user is logged in', () => {
    mockUserId = undefined;
    const { result } = renderHook(() => useUserPreferences());
    expect(result.current.preferences).toEqual(defaultUserPreferences);
  });

  describe('updatePreference', () => {
    it('calls setUserPreference with userId and partial prefs', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.updatePreference({ showShoppingListImages: false });
      });

      expect(mockSetUserPreference).toHaveBeenCalledWith('u1', {
        showShoppingListImages: false,
      });
    });

    it('does nothing when no user is logged in', () => {
      mockUserId = undefined;
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.updatePreference({ showShoppingListImages: false });
      });

      expect(mockSetUserPreference).not.toHaveBeenCalled();
    });
  });

  describe('resetPreferences', () => {
    it('calls resetUserPreferences with current userId', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.resetPreferences();
      });

      expect(mockResetUserPreferences).toHaveBeenCalledWith('u1');
    });

    it('does nothing when no user is logged in', () => {
      mockUserId = undefined;
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.resetPreferences();
      });

      expect(mockResetUserPreferences).not.toHaveBeenCalled();
    });
  });
});

describe('useShowShoppingListImages', () => {
  it('returns default value when no user is logged in', () => {
    mockUserId = undefined;
    const { result } = renderHook(() => useShowShoppingListImages());
    expect(result.current).toBe(defaultUserPreferences.showShoppingListImages);
  });

  it('returns default value when no preferences set for user', () => {
    mockUserPreferencesMap = {};
    const { result } = renderHook(() => useShowShoppingListImages());
    expect(result.current).toBe(defaultUserPreferences.showShoppingListImages);
  });

  it('returns stored showShoppingListImages value', () => {
    mockUserPreferencesMap = {
      u1: { showShoppingListImages: false },
    };
    const { result } = renderHook(() => useShowShoppingListImages());
    expect(result.current).toBe(false);
  });

  it('returns value for the correct user', () => {
    mockUserId = 'u2';
    mockUserPreferencesMap = {
      u1: { showShoppingListImages: false },
      u2: { showShoppingListImages: true },
    };
    const { result } = renderHook(() => useShowShoppingListImages());
    expect(result.current).toBe(true);
  });
});
