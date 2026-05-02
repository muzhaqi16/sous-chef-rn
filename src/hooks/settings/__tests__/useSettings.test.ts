import { renderHook, act } from '@testing-library/react-native';
import {
  useSettings,
  useShowTutorials,
  useShowNavigationLabels,
} from '../useSettings';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockUpdateAppSetting = jest.fn().mockResolvedValue(true);
const mockResetServerDefaults = jest.fn().mockResolvedValue(true);

jest.mock('#hooks/profile/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {
      showTutorials: true,
      autoSync: true,
      offlineMode: false,
    },
    loading: false,
    updateAppSetting: mockUpdateAppSetting,
    resetToDefaults: mockResetServerDefaults,
  }),
}));

let mockHapticFeedbackEnabled = true;
let mockShowNavigationLabelsValue = true;
const mockSetHapticFeedbackEnabled = jest.fn();
const mockSetShowNavigationLabels = jest.fn();
const mockResetPreferences = jest.fn();

jest.mock('#/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      hapticFeedbackEnabled: mockHapticFeedbackEnabled,
      setHapticFeedbackEnabled: mockSetHapticFeedbackEnabled,
      showNavigationLabels: mockShowNavigationLabelsValue,
      setShowNavigationLabels: mockSetShowNavigationLabels,
      resetPreferences: mockResetPreferences,
    }),
}));

let mockShowTutorialsMMKV = true;

jest.mock('#/storage/mmkv', () => ({
  storage: {
    getBoolean: (key: string) => {
      if (key === 'user_show_tutorials') return mockShowTutorialsMMKV;
      return undefined;
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHapticFeedbackEnabled = true;
  mockShowNavigationLabelsValue = true;
  mockShowTutorialsMMKV = true;
});

describe('useSettings', () => {
  it('returns unified settings combining server and local settings', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      showTutorials: true,
      autoSync: true,
      offlineMode: false,
      hapticFeedbackEnabled: true,
      showNavigationLabels: true,
    });
  });

  it('returns loading state from server', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.loading).toBe(false);
  });

  describe('actions', () => {
    it('setShowTutorials calls updateAppSetting', async () => {
      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.actions.setShowTutorials(false);
      });

      expect(mockUpdateAppSetting).toHaveBeenCalledWith('showTutorials', false);
    });

    it('setAutoSync calls updateAppSetting', async () => {
      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.actions.setAutoSync(false);
      });

      expect(mockUpdateAppSetting).toHaveBeenCalledWith('autoSync', false);
    });

    it('setOfflineMode calls updateAppSetting', async () => {
      const { result } = renderHook(() => useSettings());

      await act(async () => {
        await result.current.actions.setOfflineMode(true);
      });

      expect(mockUpdateAppSetting).toHaveBeenCalledWith('offlineMode', true);
    });

    it('setHapticFeedbackEnabled calls store setter', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.actions.setHapticFeedbackEnabled(false);
      });

      expect(mockSetHapticFeedbackEnabled).toHaveBeenCalledWith(false);
    });

    it('setShowNavigationLabels calls store setter', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.actions.setShowNavigationLabels(false);
      });

      expect(mockSetShowNavigationLabels).toHaveBeenCalledWith(false);
    });

    it('resetToDefaults resets both server and local settings', async () => {
      const { result } = renderHook(() => useSettings());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.actions.resetToDefaults();
      });

      expect(mockResetServerDefaults).toHaveBeenCalledTimes(1);
      expect(mockResetPreferences).toHaveBeenCalledTimes(1);
      expect(success).toBe(true);
    });
  });

  it('reflects local hapticFeedbackEnabled state', () => {
    mockHapticFeedbackEnabled = false;
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.hapticFeedbackEnabled).toBe(false);
  });

  it('reflects local showNavigationLabels state', () => {
    mockShowNavigationLabelsValue = false;
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.showNavigationLabels).toBe(false);
  });
});

describe('useShowTutorials', () => {
  it('returns true when MMKV value is true', () => {
    mockShowTutorialsMMKV = true;
    const { result } = renderHook(() => useShowTutorials());
    expect(result.current).toBe(true);
  });

  it('returns false when MMKV value is false', () => {
    mockShowTutorialsMMKV = false;
    const { result } = renderHook(() => useShowTutorials());
    expect(result.current).toBe(false);
  });

  it('defaults to true when MMKV value is undefined', () => {
    mockShowTutorialsMMKV = undefined as any;
    const { result } = renderHook(() => useShowTutorials());
    expect(result.current).toBe(true);
  });
});

describe('useShowNavigationLabels', () => {
  it('returns the showNavigationLabels value from store', () => {
    mockShowNavigationLabelsValue = true;
    const { result } = renderHook(() => useShowNavigationLabels());
    expect(result.current).toBe(true);
  });

  it('returns false when store has it disabled', () => {
    mockShowNavigationLabelsValue = false;
    const { result } = renderHook(() => useShowNavigationLabels());
    expect(result.current).toBe(false);
  });
});
