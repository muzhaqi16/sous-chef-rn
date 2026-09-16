'use no memo';

import { renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { flushCachePersistence } from '#/apollo/client';
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

/** The listener the hook registered last; RN's mock `remove()` unregisters nothing. */
const notifyAppState = (state: AppStateStatus) => {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls.filter(
    ([event]) => event === 'change',
  );
  const listener = calls.at(-1)?.[1] as
    | ((next: AppStateStatus) => void)
    | undefined;
  if (!listener) throw new Error('no AppState "change" listener registered');
  listener(state);
};

describe('useAppStateLifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the owed cache save when the app goes to the background', () => {
    renderHook(() => useAppStateLifecycle());

    notifyAppState('background');

    expect(flushCachePersistence).toHaveBeenCalledTimes(1);
  });

  it('does not save on a return to the foreground', () => {
    renderHook(() => useAppStateLifecycle());

    notifyAppState('active');

    expect(flushCachePersistence).not.toHaveBeenCalled();
  });
});
