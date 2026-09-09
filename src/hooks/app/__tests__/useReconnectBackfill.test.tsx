import { renderHook } from '@testing-library/react-native';
import { useReconnectBackfill } from '../useReconnectBackfill';
import { backfillActiveQueries } from '#/apollo/offline/reconnectBackfill';

jest.mock('#/apollo/offline/reconnectBackfill', () => ({
  backfillActiveQueries: jest.fn(async () => 0),
}));

// A real state object through the real `isApiUnavailable` policy, so the hook
// and the links it answers to cannot drift apart.
let mockState = {
  isOnline: true,
  apiReachable: true as boolean | null,
  offlineModeEnabled: false,
};
let mockUserId: string | undefined = 'user-1';
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector(mockState),
  useUserId: () => mockUserId,
}));

/** Kept for the tests written before the API-only outage case existed. */
const setOnline = (online: boolean) => {
  mockState = {
    ...mockState,
    isOnline: online,
    apiReachable: online ? true : null,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { isOnline: true, apiReachable: true, offlineModeEnabled: false };
  mockUserId = 'user-1';
});

describe('useReconnectBackfill', () => {
  it('does not backfill on a launch that began online', () => {
    // Every query is fetching fresh anyway; there is nothing to catch up on.
    renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();
  });

  it('backfills once when an outage ends', () => {
    setOnline(false);
    const { rerender } = renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();

    setOnline(true);
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);

    // Re-rendering while still online must not fire it again — the backfill is
    // a response to a transition, not to being online.
    rerender({});
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);
  });

  // The device link never dropped, so a hook keyed on `isOnline` saw no
  // transition and every watched query stayed on data fetched before the outage.
  it('backfills when an API-only outage ends', () => {
    mockState = {
      isOnline: true,
      apiReachable: false,
      offlineModeEnabled: false,
    };
    const { rerender } = renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();

    mockState = { ...mockState, apiReachable: true };
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);
  });

  it('backfills again on the next outage', () => {
    setOnline(false);
    const { rerender } = renderHook(() => useReconnectBackfill());
    setOnline(true);
    rerender({});
    setOnline(false);
    rerender({});
    setOnline(true);
    rerender({});

    expect(backfillActiveQueries).toHaveBeenCalledTimes(2);
  });

  it('does not backfill with nobody signed in', () => {
    setOnline(false);
    mockUserId = undefined;
    const { rerender } = renderHook(() => useReconnectBackfill());
    setOnline(true);
    rerender({});
    expect(backfillActiveQueries).not.toHaveBeenCalled();
  });
});
