import { renderHook } from '@testing-library/react-native';
import { useNetworkStatus } from '../useNetworkStatus';

const mockUseNetInfo = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  useNetInfo: () => mockUseNetInfo(),
}));

const mockSetNetworkStatus = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ setNetworkStatus: mockSetNetworkStatus }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNetworkStatus', () => {
  it('syncs store when net info reports connected and reachable', () => {
    mockUseNetInfo.mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    });

    renderHook(() => useNetworkStatus());

    expect(mockSetNetworkStatus).toHaveBeenCalledWith({
      isOnline: true,
      isInternetReachable: true,
      networkType: 'wifi',
    });
  });

  it('syncs offline when not connected', () => {
    mockUseNetInfo.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    });

    renderHook(() => useNetworkStatus());

    expect(mockSetNetworkStatus).toHaveBeenCalledWith({
      isOnline: false,
      isInternetReachable: false,
      networkType: 'none',
    });
  });

  it('treats isInternetReachable === null as online (indeterminate)', () => {
    mockUseNetInfo.mockReturnValue({
      isConnected: true,
      isInternetReachable: null,
      type: 'wifi',
    });

    renderHook(() => useNetworkStatus());

    expect(mockSetNetworkStatus).toHaveBeenCalledWith(
      expect.objectContaining({ isOnline: true }),
    );
  });

  it('treats isConnected === false as offline even when isInternetReachable is null', () => {
    mockUseNetInfo.mockReturnValue({
      isConnected: false,
      isInternetReachable: null,
      type: 'none',
    });

    renderHook(() => useNetworkStatus());

    expect(mockSetNetworkStatus).toHaveBeenCalledWith(
      expect.objectContaining({ isOnline: false }),
    );
  });

  it('skips sync while NetInfo is still indeterminate (isConnected === null)', () => {
    mockUseNetInfo.mockReturnValue({
      isConnected: null,
      isInternetReachable: null,
      type: 'unknown',
    });

    renderHook(() => useNetworkStatus());

    expect(mockSetNetworkStatus).not.toHaveBeenCalled();
  });
});
