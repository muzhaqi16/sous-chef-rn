import { renderHook } from '@testing-library/react-native';
import { useNetworkStatus } from '../useNetworkStatus';

// Track the callback registered with addEventListener
let netInfoCallback: ((state: any) => void) | null = null;
const mockUnsubscribe = jest.fn();
const mockFetch = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args: unknown[]) => mockFetch(...args),
    addEventListener: (cb: (state: any) => void) => {
      netInfoCallback = cb;
      return mockUnsubscribe;
    },
  },
}));

const mockSetNetworkStatus = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ setNetworkStatus: mockSetNetworkStatus }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  netInfoCallback = null;
  mockFetch.mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  });
});

describe('useNetworkStatus', () => {
  it('fetches initial network state on mount', async () => {
    renderHook(() => useNetworkStatus());

    // Flush the microtask from NetInfo.fetch().then()
    await Promise.resolve();
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockSetNetworkStatus).toHaveBeenCalledWith({
      isOnline: true,
      isInternetReachable: true,
      networkType: 'wifi',
    });
  });

  it('subscribes to network changes via addEventListener', () => {
    renderHook(() => useNetworkStatus());

    expect(netInfoCallback).toBeTruthy();
  });

  it('updates store when network state changes', () => {
    renderHook(() => useNetworkStatus());

    // Simulate going offline
    netInfoCallback?.({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    });

    expect(mockSetNetworkStatus).toHaveBeenCalledWith({
      isOnline: false,
      isInternetReachable: false,
      networkType: 'none',
    });
  });

  it('treats isInternetReachable === null as online (initial indeterminate)', () => {
    renderHook(() => useNetworkStatus());

    netInfoCallback?.({
      isConnected: true,
      isInternetReachable: null,
      type: 'wifi',
    });

    // isConnected: true && isInternetReachable !== false → isOnline: true
    expect(mockSetNetworkStatus).toHaveBeenCalledWith(
      expect.objectContaining({ isOnline: true }),
    );
  });

  it('treats isConnected === false as offline even when isInternetReachable is null', () => {
    renderHook(() => useNetworkStatus());

    netInfoCallback?.({
      isConnected: false,
      isInternetReachable: null,
      type: 'none',
    });

    expect(mockSetNetworkStatus).toHaveBeenCalledWith(
      expect.objectContaining({ isOnline: false }),
    );
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
