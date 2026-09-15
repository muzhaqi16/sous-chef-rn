import { renderHook } from '@testing-library/react-native';
import { useIsEffectivelyOffline } from '../useOfflineMode';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockIsOnline = true;
let mockOfflineModeEnabled = false;

jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    isOnline: mockIsOnline,
    offlineModeEnabled: mockOfflineModeEnabled,
  });
  return {
    useAppStore: <T>(selector: (state: ReturnType<typeof getState>) => T) =>
      selector(getState()),
    useIsOnline: () => (s => s.isOnline)(getState()),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOnline = true;
  mockOfflineModeEnabled = false;
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
