import { renderHook, act } from '@testing-library/react-native';
import { useTheme } from '../useTheme';

const mockSetTheme = jest.fn();
const mockSetAdaptiveThemes = jest.fn();
const mockSetUnistylesTheme = jest.fn();

let mockUserThemePreference = 'SYSTEM';

jest.mock('#/store/useAppStore', () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({
      theme: mockUserThemePreference,
      setTheme: mockSetTheme,
      isHydrated: true,
    }),
  usePreferences: jest.fn(() => ({
    theme: mockUserThemePreference,
    setTheme: mockSetTheme,
  })),
  useIsHydrated: jest.fn(() => true),
}));

jest.mock('zustand/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('react-native-unistyles', () => ({
  useUnistyles: jest.fn(() => ({
    rt: {
      colorScheme: 'light',
      themeName: 'light',
    },
  })),
  UnistylesRuntime: {
    setAdaptiveThemes: (...args: any[]) => mockSetAdaptiveThemes(...args),
    setTheme: (...args: any[]) => mockSetUnistylesTheme(...args),
    themeName: 'light',
  },
}));

jest.mock('#/store/slices/preferencesSlice', () => ({
  ThemePreference: {
    LIGHT: 'LIGHT',
    DARK: 'DARK',
    SYSTEM: 'SYSTEM',
  },
}));

// Break circular dependency
jest.mock('../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
  mockUserThemePreference = 'SYSTEM';
});

describe('useTheme', () => {
  it('returns theme as light by default', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('returns isFollowingSystem true when preference is SYSTEM', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.isFollowingSystem).toBe(true);
  });

  it('returns isFollowingSystem false when preference is DARK', () => {
    mockUserThemePreference = 'DARK';

    const { result } = renderHook(() => useTheme());

    expect(result.current.isFollowingSystem).toBe(false);
  });

  it('returns systemColorScheme from runtime', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.systemColorScheme).toBe('light');
  });

  it('exposes setTheme and helper setters', () => {
    const { result } = renderHook(() => useTheme());

    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.setLightTheme).toBe('function');
    expect(typeof result.current.setDarkTheme).toBe('function');
    expect(typeof result.current.setSystemTheme).toBe('function');
  });

  it('setLightTheme calls setTheme with LIGHT', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setLightTheme();
    });

    expect(mockSetTheme).toHaveBeenCalledWith('LIGHT');
  });

  it('setDarkTheme calls setTheme with DARK', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setDarkTheme();
    });

    expect(mockSetTheme).toHaveBeenCalledWith('DARK');
  });

  it('setSystemTheme calls setTheme with SYSTEM', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setSystemTheme();
    });

    expect(mockSetTheme).toHaveBeenCalledWith('SYSTEM');
  });
});
