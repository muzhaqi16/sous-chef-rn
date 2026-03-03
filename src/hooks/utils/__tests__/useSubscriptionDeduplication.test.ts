'use no memo';

import { renderHook } from '@testing-library/react-native';
import {
  useSubscriptionDeduplication,
  getEntityIdFromPayload,
} from '../useSubscriptionDeduplication';

describe('useSubscriptionDeduplication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false for null payload', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    expect(result.current(null)).toBe(false);
  });

  it('returns false for undefined payload', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    expect(result.current(undefined)).toBe(false);
  });

  it('filters out updates from the current user (self-echo)', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    const shouldProcess = result.current({
      mutation: 'CREATED',
      userId: 'user-1',
      timestamp: '2026-01-01T00:00:00Z',
      item: { id: 'item-1' },
    });

    expect(shouldProcess).toBe(false);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('⏭️ Skipping self-echo subscription update from current user'),
    );
  });

  it('allows updates from other users', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    const shouldProcess = result.current({
      mutation: 'CREATED',
      userId: 'user-2',
      timestamp: '2026-01-01T00:00:00Z',
      item: { id: 'item-1' },
    });

    expect(shouldProcess).toBe(true);
  });

  it('allows updates when currentUserId is null', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication(null));

    const shouldProcess = result.current({
      mutation: 'UPDATED',
      userId: 'user-1',
      timestamp: '2026-01-01T00:00:00Z',
    });

    expect(shouldProcess).toBe(true);
  });

  it('allows updates when currentUserId is undefined', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication(undefined));

    const shouldProcess = result.current({
      mutation: 'UPDATED',
      userId: 'user-1',
      timestamp: '2026-01-01T00:00:00Z',
    });

    expect(shouldProcess).toBe(true);
  });

  it('filters out duplicate updates with same mutation+timestamp', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    const payload = {
      mutation: 'UPDATED',
      userId: 'user-2',
      timestamp: '2026-01-01T00:00:00Z',
      item: { id: 'item-1' },
    };

    const first = result.current(payload);
    const second = result.current(payload);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('⏭️ Skipping duplicate subscription update:'),
      expect.anything(),
    );
  });

  it('allows updates with different mutation+timestamp combinations', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    const first = result.current({
      mutation: 'CREATED',
      userId: 'user-2',
      timestamp: '2026-01-01T00:00:00Z',
    });

    const second = result.current({
      mutation: 'UPDATED',
      userId: 'user-2',
      timestamp: '2026-01-01T00:00:01Z',
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it('allows updates without timestamp/mutation (no dedup key)', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    const first = result.current({ userId: 'user-2' });
    const second = result.current({ userId: 'user-2' });

    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it('evicts oldest entries when processed set exceeds 50', () => {
    const { result } = renderHook(() => useSubscriptionDeduplication('user-1'));

    // Add 51 unique mutations
    for (let i = 0; i < 51; i++) {
      result.current({
        mutation: 'UPDATED',
        userId: 'user-2',
        timestamp: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      });
    }

    // The first entry should have been evicted, so re-sending it should pass
    const shouldProcess = result.current({
      mutation: 'UPDATED',
      userId: 'user-2',
      timestamp: '2026-01-01T00:00:00Z',
    });

    expect(shouldProcess).toBe(true);
  });
});

describe('getEntityIdFromPayload', () => {
  it('returns null for null payload', () => {
    expect(getEntityIdFromPayload(null)).toBeNull();
  });

  it('returns null for undefined payload', () => {
    expect(getEntityIdFromPayload(undefined)).toBeNull();
  });

  it('extracts id from payload.item', () => {
    expect(
      getEntityIdFromPayload({
        mutation: 'CREATED',
        item: { id: 'item-123' },
      }),
    ).toBe('item-123');
  });

  it('extracts id from payload.node', () => {
    expect(
      getEntityIdFromPayload({
        mutation: 'CREATED',
        node: { id: 'node-456' },
      }),
    ).toBe('node-456');
  });

  it('prefers item.id over node.id', () => {
    expect(
      getEntityIdFromPayload({
        mutation: 'CREATED',
        item: { id: 'item-1' },
        node: { id: 'node-1' },
      }),
    ).toBe('item-1');
  });

  it('returns null when neither item nor node has id', () => {
    expect(
      getEntityIdFromPayload({
        mutation: 'CREATED',
      }),
    ).toBeNull();
  });
});
