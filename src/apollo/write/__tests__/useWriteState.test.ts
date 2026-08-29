import { renderHook, act } from '@testing-library/react-native';
import { Kind } from 'graphql';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus, type QueuedMutation } from '#/apollo/offlineQueue/types';
import { useIsWritePending } from '../useWriteState';

/**
 * The pending indicator is the only thing distinguishing a row whose edit has
 * reached the server from one still sitting in the offline queue.
 *
 * It had NO affirmative coverage: an always-false implementation passed the
 * entire suite, so the badge could disappear entirely and nothing would report
 * it. These are the two directions plus the live update.
 */
const queued = (id: string): QueuedMutation => ({
  id: `q-${id}`,
  userId: 'user-1',
  operationName: 'UpdatePantryItem',
  mutation: { kind: Kind.DOCUMENT, definitions: [] },
  variables: { input: { id } },
  status: QueueStatus.PENDING,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  retryCount: 0,
  maxRetries: 3,
  requiresAuth: true,
});

describe('useIsWritePending', () => {
  beforeEach(() => {
    queueStore.clearAllQueues();
    queueStore.setCurrentUserId('user-1');
  });

  it('is true while the row has a queued write', () => {
    queueStore.addMutation(queued('pantry-1'));

    const { result } = renderHook(() => useIsWritePending('pantry-1'));

    expect(result.current).toBe(true);
  });

  it('is false for a row with nothing queued', () => {
    queueStore.addMutation(queued('pantry-1'));

    const { result } = renderHook(() => useIsWritePending('other-row'));

    expect(result.current).toBe(false);
  });

  it('is false when nothing is queued at all', () => {
    const { result } = renderHook(() => useIsWritePending('pantry-1'));

    expect(result.current).toBe(false);
  });

  it('clears when the write leaves the queue', () => {
    // The transition is the point: a row must stop showing "syncing" once its
    // write lands, without the screen remounting.
    queueStore.addMutation(queued('pantry-1'));
    const { result } = renderHook(() => useIsWritePending('pantry-1'));
    expect(result.current).toBe(true);

    act(() => {
      queueStore.removeMutation('q-pantry-1');
    });

    expect(result.current).toBe(false);
  });

  it('is false for an absent id rather than throwing', () => {
    const { result } = renderHook(() => useIsWritePending(undefined));

    expect(result.current).toBe(false);
  });
});
