import { renderHook } from '@testing-library/react-native';
import { useIsOfflineBannerVisible } from '../useIsOfflineBannerVisible';

// Break circular dependency chain (matches useOfflineMode.test.ts).
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockIsOnline = true;
let mockApiReachable = true;
let mockOfflineModeEnabled = false;

jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    isOnline: mockIsOnline,
    apiReachable: mockApiReachable,
    offlineModeEnabled: mockOfflineModeEnabled,
  });
  return {
    useAppStore: <T>(selector: (state: ReturnType<typeof getState>) => T) =>
      selector(getState()),
  };
});

beforeEach(() => {
  mockIsOnline = true;
  mockApiReachable = true;
  mockOfflineModeEnabled = false;
});

describe('useIsOfflineBannerVisible', () => {
  it('is visible when the device is offline', () => {
    mockIsOnline = false;
    const { result } = renderHook(() => useIsOfflineBannerVisible());
    expect(result.current).toBe(true);
  });

  it('is visible when the API is unreachable while the device is online', () => {
    mockApiReachable = false;
    const { result } = renderHook(() => useIsOfflineBannerVisible());
    expect(result.current).toBe(true);
  });

  it('is visible when offline mode is enabled', () => {
    mockOfflineModeEnabled = true;
    const { result } = renderHook(() => useIsOfflineBannerVisible());
    expect(result.current).toBe(true);
  });

  it('is hidden when online, reachable, and offline mode is off', () => {
    const { result } = renderHook(() => useIsOfflineBannerVisible());
    expect(result.current).toBe(false);
  });
});
