import { renderHook } from '@testing-library/react-native';
import {
  useOfflineMode,
  useIsEffectivelyOffline,
  useCanUseNetwork,
} from '../useOfflineMode';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockIsOnline = true;
let mockOfflineModeEnabled = false;

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      isOnline: mockIsOnline,
      offlineModeEnabled: mockOfflineModeEnabled,
    }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOnline = true;
  mockOfflineModeEnabled = false;
});

describe('useOfflineMode', () => {
  it('returns all false when online and offline mode disabled', () => {
    const { result } = renderHook(() => useOfflineMode());

    expect(result.current.isEffectivelyOffline).toBe(false);
    expect(result.current.isDeviceOffline).toBe(false);
    expect(result.current.isOfflineModeEnabled).toBe(false);
    expect(result.current.canUseNetwork).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('returns isDeviceOffline true when device is offline', () => {
    mockIsOnline = false;
    const { result } = renderHook(() => useOfflineMode());

    expect(result.current.isDeviceOffline).toBe(true);
    expect(result.current.isEffectivelyOffline).toBe(true);
    expect(result.current.canUseNetwork).toBe(false);
  });

  it('returns isOfflineModeEnabled true when user enabled offline mode', () => {
    mockOfflineModeEnabled = true;
    const { result } = renderHook(() => useOfflineMode());

    expect(result.current.isOfflineModeEnabled).toBe(true);
    expect(result.current.isEffectivelyOffline).toBe(true);
    expect(result.current.canUseNetwork).toBe(false);
  });

  it('returns effectively offline when both device offline and offline mode enabled', () => {
    mockIsOnline = false;
    mockOfflineModeEnabled = true;
    const { result } = renderHook(() => useOfflineMode());

    expect(result.current.isEffectivelyOffline).toBe(true);
    expect(result.current.isDeviceOffline).toBe(true);
    expect(result.current.isOfflineModeEnabled).toBe(true);
    expect(result.current.canUseNetwork).toBe(false);
  });

  it('loading is always false', () => {
    const { result } = renderHook(() => useOfflineMode());
    expect(result.current.loading).toBe(false);
  });
});

describe('useIsEffectivelyOffline', () => {
  it('returns false when online and offline mode disabled', () => {
    const { result } = renderHook(() => useIsEffectivelyOffline());
    expect(result.current).toBe(false);
  });

  it('returns true when device is offline', () => {
    mockIsOnline = false;
    const { result } = renderHook(() => useIsEffectivelyOffline());
    expect(result.current).toBe(true);
  });

  it('returns true when offline mode is enabled', () => {
    mockOfflineModeEnabled = true;
    const { result } = renderHook(() => useIsEffectivelyOffline());
    expect(result.current).toBe(true);
  });
});

describe('useCanUseNetwork', () => {
  it('returns true when online and offline mode disabled', () => {
    const { result } = renderHook(() => useCanUseNetwork());
    expect(result.current).toBe(true);
  });

  it('returns false when device is offline', () => {
    mockIsOnline = false;
    const { result } = renderHook(() => useCanUseNetwork());
    expect(result.current).toBe(false);
  });

  it('returns false when offline mode is enabled', () => {
    mockOfflineModeEnabled = true;
    const { result } = renderHook(() => useCanUseNetwork());
    expect(result.current).toBe(false);
  });
});
