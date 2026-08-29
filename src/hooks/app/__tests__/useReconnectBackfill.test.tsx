import { renderHook } from '@testing-library/react-native';
import { useReconnectBackfill } from '../useReconnectBackfill';
import { backfillActiveQueries } from '#/apollo/offline/reconnectBackfill';

jest.mock('#/apollo/offline/reconnectBackfill', () => ({
  backfillActiveQueries: jest.fn(async () => 0),
}));

// The trigger is the DERIVED reachability decision, not the raw device link —
// so that is what this doubles. An API-only outage never moves `isOnline`, and
// keying on it is how such an outage used to end with no backfill at all.
let mockUnavailable = false;
let mockUserId: string | undefined = 'user-1';
jest.mock('#/hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => mockUnavailable,
}));
jest.mock('#store/useAppStore', () => ({
  useUserId: () => mockUserId,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUnavailable = false;
  mockUserId = 'user-1';
});

describe('useReconnectBackfill', () => {
  it('does not backfill on a launch that began healthy', () => {
    // Every query is fetching fresh anyway; there is nothing to catch up on.
    renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();
  });

  it('backfills once when an outage ends', () => {
    mockUnavailable = true;
    const { rerender } = renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();

    mockUnavailable = false;
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);

    // Re-rendering while still available must not fire it again — the backfill
    // is a response to a transition, not to being available.
    rerender({});
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);
  });

  it('backfills after an API-only outage, where the device link never dropped', () => {
    // The most common outage shape there is — a deploy, a 5xx window, an LB
    // blip — and the only one the reachability breaker exists for. Keying on
    // the device link meant every mounted screen kept pre-outage data
    // indefinitely: `nextFetchPolicy: 'cache-first'` stops a settled observable
    // correcting itself, and `HomeTabs` runs `inactiveBehavior: 'none'` so
    // background tabs stay mounted too. No spinner, no error, no banner.
    mockUnavailable = true; // apiReachable false; isOnline stayed true throughout
    const { rerender } = renderHook(() => useReconnectBackfill());

    mockUnavailable = false;
    rerender({});

    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);
  });

  it('backfills again on the next outage', () => {
    mockUnavailable = true;
    const { rerender } = renderHook(() => useReconnectBackfill());
    mockUnavailable = false;
    rerender({});
    mockUnavailable = true;
    rerender({});
    mockUnavailable = false;
    rerender({});

    expect(backfillActiveQueries).toHaveBeenCalledTimes(2);
  });

  it('does not backfill with nobody signed in', () => {
    mockUnavailable = true;
    mockUserId = undefined;
    const { rerender } = renderHook(() => useReconnectBackfill());
    mockUnavailable = false;
    rerender({});
    expect(backfillActiveQueries).not.toHaveBeenCalled();
  });
});
