import type { DocumentNode } from 'graphql';
import { unconfirmedCreates } from '../unconfirmedCreates';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus, type QueuedMutation } from '#/apollo/offlineQueue/types';
import { storage } from '#storage/mmkv';

function makeQueuedCreate(clientId: string): QueuedMutation {
  return {
    id: `mut-${clientId}`,
    userId: 'user-1',
    operationName: 'CreateMealPlan',
    mutation: { kind: 'Document', definitions: [] } as DocumentNode,
    variables: { input: { id: clientId, name: 'Camping Trip' } },
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
  };
}

beforeEach(() => {
  storage.clearAll();
  queueStore.invalidateCache();
});

describe('unconfirmedCreates', () => {
  it('reports an id as unconfirmed only between mark and confirm', () => {
    expect(unconfirmedCreates.has('plan-1')).toBe(false);

    unconfirmedCreates.mark('plan-1');
    expect(unconfirmedCreates.has('plan-1')).toBe(true);
    // Other ids are unaffected.
    expect(unconfirmedCreates.has('plan-2')).toBe(false);

    unconfirmedCreates.confirm('plan-1');
    expect(unconfirmedCreates.has('plan-1')).toBe(false);
  });

  it('notifies subscribers on mark and confirm, and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = unconfirmedCreates.subscribe(listener);

    unconfirmedCreates.mark('plan-1');
    expect(listener).toHaveBeenCalledTimes(1);

    // A redundant mark is not a change — no re-render for consumers.
    unconfirmedCreates.mark('plan-1');
    expect(listener).toHaveBeenCalledTimes(1);

    unconfirmedCreates.confirm('plan-1');
    expect(listener).toHaveBeenCalledTimes(2);

    // Confirming an id that was never marked is a no-op.
    unconfirmedCreates.confirm('plan-unknown');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    unconfirmedCreates.mark('plan-2');
    expect(listener).toHaveBeenCalledTimes(2);

    unconfirmedCreates.confirm('plan-2');
  });

  it('keeps an id unconfirmed while its create waits in the offline queue', () => {
    queueStore.setCurrentUserId('user-1');
    queueStore.addMutation(makeQueuedCreate('plan-queued'));

    // The in-flight window has closed — the queue is what still holds the id.
    expect(unconfirmedCreates.has('plan-queued')).toBe(true);

    queueStore.removeMutation('mut-plan-queued');
    expect(unconfirmedCreates.has('plan-queued')).toBe(false);
  });

  it('relays queue changes to subscribers while anyone is listening', () => {
    queueStore.setCurrentUserId('user-1');
    const listener = jest.fn();
    const unsubscribe = unconfirmedCreates.subscribe(listener);
    listener.mockClear();

    // A replay draining the queue must reach consumers — that transition is
    // what unskips the detail query for an offline-created row.
    queueStore.addMutation(makeQueuedCreate('plan-queued'));
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();
    queueStore.removeMutation('mut-plan-queued');
    expect(listener).not.toHaveBeenCalled();
  });
});
