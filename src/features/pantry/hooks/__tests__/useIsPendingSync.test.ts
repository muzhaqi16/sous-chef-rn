/**
 * A row created or edited offline looked identical to a synced one, so nothing
 * on screen distinguished work that had reached the server from work still
 * waiting in the queue.
 *
 * The snapshot must stay a primitive: this runs in a FlashList cell, so
 * returning the pending Set itself would re-render every visible row whenever
 * any queue entry changed.
 */
import { renderHook } from '@testing-library/react-native';
import { useIsPendingSync } from '#features/pantry/hooks/useIsPendingSync';
import { queueStore } from '#/apollo/offlineQueue/queueStore';

jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: {
    subscribe: jest.fn(() => () => {}),
    getPendingClientIds: jest.fn(() => new Set<string>()),
  },
}));

const mockedStore = queueStore as unknown as {
  subscribe: jest.Mock;
  getPendingClientIds: jest.Mock;
};

describe('useIsPendingSync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is true for an id still waiting in the queue', () => {
    mockedStore.getPendingClientIds.mockReturnValue(new Set(['item-1']));
    const { result } = renderHook(() => useIsPendingSync('item-1'));
    expect(result.current).toBe(true);
  });

  it('is false for an id the queue does not hold', () => {
    mockedStore.getPendingClientIds.mockReturnValue(new Set(['other']));
    const { result } = renderHook(() => useIsPendingSync('item-1'));
    expect(result.current).toBe(false);
  });

  it('is false, and does not read the queue, without an id', () => {
    const { result } = renderHook(() => useIsPendingSync(undefined));
    expect(result.current).toBe(false);
    expect(mockedStore.getPendingClientIds).not.toHaveBeenCalled();
  });

  it('subscribes to queue changes', () => {
    renderHook(() => useIsPendingSync('item-1'));
    expect(mockedStore.subscribe).toHaveBeenCalled();
  });
});
