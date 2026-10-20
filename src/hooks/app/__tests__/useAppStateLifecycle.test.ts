'use no memo';

import { renderHook } from '@testing-library/react-native';
import { flushCachePersistence } from '#/apollo/client';
import { memoryLifecycle } from '#/test-utils/memoryPlatform';
import { useAppStateLifecycle } from '../useAppStateLifecycle';

jest.mock('#/apollo/client', () => ({
  flushCachePersistence: jest.fn(),
}));
jest.mock('#store/useAppStore', () => ({
  useIsHydrated: () => true,
}));
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { processQueue: jest.fn(() => Promise.resolve()) },
}));
jest.mock('#/apollo/links/apiReachabilityBreaker', () => ({
  apiReachabilityBreaker: { onAppForeground: jest.fn() },
}));
jest.mock('#store/slices/authSlice', () => ({
  ...jest.requireActual('#store/slices/authSlice'),
  handleTokenRefreshOnResume: jest.fn(() => Promise.resolve()),
}));

describe('useAppStateLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    memoryLifecycle().moveTo('active');
  });

  it('writes the owed cache save when the app goes to the background', () => {
    renderHook(() => useAppStateLifecycle());

    memoryLifecycle().moveTo('background');

    expect(flushCachePersistence).toHaveBeenCalledTimes(1);
  });

  it('does not save on a return to the foreground', () => {
    renderHook(() => useAppStateLifecycle());

    memoryLifecycle().moveTo('background');
    jest.clearAllMocks();
    memoryLifecycle().moveTo('active');

    expect(flushCachePersistence).not.toHaveBeenCalled();
  });
});
