import { renderHook } from '@testing-library/react-native';
import { PlatformServiceMissing } from '#platform/install';
import type { PlatformServices } from '#platform/ports';
import { useStore } from '#store';
import { memoryConnectivity } from '#/test-utils/memoryPlatform';
import { useNetworkStatusSync } from '../useNetworkStatusSync';

const network = () => {
  const { isOnline, isInternetReachable, networkType } = useStore.getState();
  return { isOnline, isInternetReachable, networkType };
};

beforeEach(() => {
  memoryConnectivity().report({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  });
  useStore.setState({
    isOnline: true,
    isInternetReachable: true,
    networkType: 'wifi',
  });
});

describe('useNetworkStatusSync', () => {
  it('syncs the store when the network is connected and reachable', () => {
    memoryConnectivity().report({
      isConnected: true,
      isInternetReachable: true,
      type: 'cellular',
    });

    renderHook(() => useNetworkStatusSync());

    expect(network()).toEqual({
      isOnline: true,
      isInternetReachable: true,
      networkType: 'cellular',
    });
  });

  it('goes offline when the network drops, and back online when it returns', () => {
    renderHook(() => useNetworkStatusSync());

    memoryConnectivity().report({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    });
    expect(network()).toEqual({
      isOnline: false,
      isInternetReachable: false,
      networkType: 'none',
    });

    memoryConnectivity().report({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    });
    expect(network().isOnline).toBe(true);
  });

  it('treats a reachability not probed yet as online', () => {
    memoryConnectivity().report({
      isConnected: true,
      isInternetReachable: null,
      type: 'wifi',
    });

    renderHook(() => useNetworkStatusSync());

    expect(network()).toEqual({
      isOnline: true,
      isInternetReachable: null,
      networkType: 'wifi',
    });
  });

  it('treats a lost connection as offline even with reachability unprobed', () => {
    memoryConnectivity().report({
      isConnected: false,
      isInternetReachable: null,
      type: 'none',
    });

    renderHook(() => useNetworkStatusSync());

    expect(network().isOnline).toBe(false);
  });

  it('skips the report before the first real one', () => {
    useStore.setState({ isOnline: false, networkType: 'none' });
    memoryConnectivity().report({
      isConnected: null,
      isInternetReachable: null,
      type: 'unknown',
    });

    renderHook(() => useNetworkStatusSync());

    expect(network()).toEqual({
      isOnline: false,
      isInternetReachable: true,
      networkType: 'none',
    });
  });

  it('stops listening when it unmounts', () => {
    const { unmount } = renderHook(() => useNetworkStatusSync());
    unmount();

    memoryConnectivity().report({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    });

    expect(network().isOnline).toBe(true);
  });

  it('names the service when the host supplies no connectivity', () => {
    const INSTALLED = Symbol.for('sous-chef.platform');
    const registry = globalThis as {
      [INSTALLED]?: Partial<PlatformServices>;
    };
    const installed = registry[INSTALLED];
    const { connectivity: _omitted, ...withoutConnectivity } = installed ?? {};
    registry[INSTALLED] = withoutConnectivity;
    jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => renderHook(() => useNetworkStatusSync())).toThrow(
        new PlatformServiceMissing('connectivity', true),
      );
    } finally {
      registry[INSTALLED] = installed;
      jest.restoreAllMocks();
    }
  });
});
