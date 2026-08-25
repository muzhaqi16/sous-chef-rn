import { renderHook } from '@testing-library/react-native';
import { useReconnectBackfill } from '../useReconnectBackfill';
import { backfillActiveQueries } from '#/apollo/offline/reconnectBackfill';

jest.mock('#/apollo/offline/reconnectBackfill', () => ({
  backfillActiveQueries: jest.fn(async () => 0),
}));

let mockOnline = true;
let mockUserId: string | undefined = 'user-1';
jest.mock('#store/useAppStore', () => ({
  useIsOnline: () => mockOnline,
  useUserId: () => mockUserId,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  mockUserId = 'user-1';
});

describe('useReconnectBackfill', () => {
  it('does not backfill on a launch that began online', () => {
    // Every query is fetching fresh anyway; there is nothing to catch up on.
    renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();
  });

  it('backfills once when an outage ends', () => {
    mockOnline = false;
    const { rerender } = renderHook(() => useReconnectBackfill());
    expect(backfillActiveQueries).not.toHaveBeenCalled();

    mockOnline = true;
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);

    // Re-rendering while still online must not fire it again — the backfill is
    // a response to a transition, not to being online.
    rerender({});
    rerender({});
    expect(backfillActiveQueries).toHaveBeenCalledTimes(1);
  });

  it('backfills again on the next outage', () => {
    mockOnline = false;
    const { rerender } = renderHook(() => useReconnectBackfill());
    mockOnline = true;
    rerender({});
    mockOnline = false;
    rerender({});
    mockOnline = true;
    rerender({});

    expect(backfillActiveQueries).toHaveBeenCalledTimes(2);
  });

  it('does not backfill with nobody signed in', () => {
    mockOnline = false;
    mockUserId = undefined;
    const { rerender } = renderHook(() => useReconnectBackfill());
    mockOnline = true;
    rerender({});
    expect(backfillActiveQueries).not.toHaveBeenCalled();
  });
});
