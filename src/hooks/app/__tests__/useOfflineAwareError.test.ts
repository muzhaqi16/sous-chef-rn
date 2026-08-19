import { renderHook } from '@testing-library/react-native';
import { useOfflineAwareError } from '../useOfflineAwareError';

jest.mock('#hooks/app/useBlocksCacheMissQueries', () => ({
  useBlocksCacheMissQueries: jest.fn(() => false),
}));

const mocked = jest.requireMock('#hooks/app/useBlocksCacheMissQueries') as {
  useBlocksCacheMissQueries: jest.Mock;
};

const setNetworkBlocked = (blocked: boolean) =>
  mocked.useBlocksCacheMissQueries.mockReturnValue(blocked);

const failure = new Error('boom');

describe('useOfflineAwareError', () => {
  beforeEach(() => setNetworkBlocked(false));

  it('reclassifies an error as offline when no network was attempted and nothing is cached', () => {
    setNetworkBlocked(true);

    const { result } = renderHook(() => useOfflineAwareError(failure, false));

    expect(result.current.offline).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('keeps a failure that happened while online as an error', () => {
    const { result } = renderHook(() => useOfflineAwareError(failure, false));

    expect(result.current.offline).toBe(false);
    expect(result.current.error).toBe(failure);
  });

  it('keeps the error when cached data is on screen', () => {
    // A cached hit whose background revalidation failed. The user is looking at
    // real data, so the failure is reportable rather than an offline state.
    setNetworkBlocked(true);

    const { result } = renderHook(() => useOfflineAwareError(failure, true));

    expect(result.current.offline).toBe(false);
    expect(result.current.error).toBe(failure);
  });

  it('reports neither when there is no error', () => {
    setNetworkBlocked(true);

    const { result } = renderHook(() => useOfflineAwareError(undefined, false));

    expect(result.current.offline).toBe(false);
    expect(result.current.error).toBeUndefined();
  });
});
