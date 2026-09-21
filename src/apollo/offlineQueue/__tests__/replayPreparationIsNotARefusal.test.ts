import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { useStore } from '#store';
import { QueueStatus } from '../types';
import { classifyError, ReplayNotPreparedError } from '../queueErrorPolicy';
import { makeCache } from '#/apollo/cache';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  queuedMutationFor,
  makeQueuedMutation,
} from '#/test-utils/queuedMutation';
import {
  AddItemToShoppingListDocument,
  ToggleShoppingListItemPurchasedDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';

/**
 * A replay the device could not BUILD is not a refusal. The server never saw
 * it, so the entry is parked for the next drain rather than withdrawn under a
 * toast saying the change was rejected.
 */

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

const mockClient = {
  mutate: jest.fn(),
  cache: makeCache(),
};
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

jest.mock('../queueStore', () => ({
  queueStore: {
    updateMutation: jest.fn(() => true),
    removeMutation: jest.fn(() => true),
    incrementRetry: jest.fn(() => true),
    markMutationFailed: jest.fn(() => true),
    getPendingMutationsForUser: jest.fn(() => []),
    getQueueStats: jest.fn(() => ({
      total: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      authErrors: 0,
    })),
    invalidateCache: jest.fn(),
  },
}));

/** An update-shaped entry: its input carries no parent id, so the builder reads one. */
const toggleEntry = () =>
  makeQueuedMutation({
    id: 'toggle-1',
    ...queuedMutationFor(ToggleShoppingListItemPurchasedDocument),
    variables: { input: { id: 'sli-1', purchased: true, version: 3 } },
  });

describe('a replay that cannot be prepared on the device', () => {
  let manager: QueueManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.cache = makeCache();
    (useStore.getState as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      isOnline: true,
      apiReachable: true,
      accessToken: 'token',
    });
    manager = new QueueManager();
  });

  it('is raised as a prepared-failure, not as a bare Error', async () => {
    // The cache was purged (a version bump) while the queue survived, so the
    // parent id this entry's replay reads is gone.
    const executeMutation = manager['executeMutation'].bind(manager);

    await expect(executeMutation(toggleEntry())).rejects.toBeInstanceOf(
      ReplayNotPreparedError,
    );
  });

  it('classifies as a deferral that keeps the entry, not a permanent refusal', () => {
    const queueError = classifyError(
      new ReplayNotPreparedError(
        operationNameOf(ToggleShoppingListItemPurchasedDocument),
        new Error('shoppingListId not found for item sli-1'),
      ),
    );

    expect(queueError.type).toBe('server');
    // Deferred without an in-run retry loop: every attempt would read the same
    // empty cache.
    expect(queueError.retryable).toBe(false);
  });

  it('keeps the write and says nothing about it being rejected', async () => {
    const failureHandler = jest.fn();
    manager.setFailureHandler(failureHandler);
    const handleMutationError = manager['handleMutationError'].bind(manager);

    const result = await handleMutationError(
      toggleEntry(),
      new ReplayNotPreparedError(
        operationNameOf(ToggleShoppingListItemPurchasedDocument),
        new Error('x'),
      ),
    );

    expect(failureHandler).not.toHaveBeenCalled();
    expect(queueStore.markMutationFailed).not.toHaveBeenCalled();
    expect(queueStore.removeMutation).not.toHaveBeenCalled();
    expect(queueStore.updateMutation).toHaveBeenCalledWith(
      'toggle-1',
      expect.objectContaining({ status: QueueStatus.PENDING }),
    );
    expect(result.deferred).toBe(true);
  });

  it('holds only this entry, leaving the rest of the pass to run', async () => {
    const handleMutationError = manager['handleMutationError'].bind(manager);

    const result = await handleMutationError(
      toggleEntry(),
      new ReplayNotPreparedError(
        operationNameOf(ToggleShoppingListItemPurchasedDocument),
        new Error('x'),
      ),
    );

    // A transport-scoped deferral pauses the whole drain; one entry whose
    // replay cannot be built is the entry's own problem.
    expect(result.deferralScope).toBe('entry');
  });

  it('does not spin: the entry is not retried inside the pass', async () => {
    const handleMutationError = manager['handleMutationError'].bind(manager);
    const processMutation = jest.spyOn(
      manager as unknown as { processMutation: () => Promise<unknown> },
      'processMutation',
    );

    await handleMutationError(
      toggleEntry(),
      new ReplayNotPreparedError(
        operationNameOf(ToggleShoppingListItemPurchasedDocument),
        new Error('x'),
      ),
    );

    expect(processMutation).not.toHaveBeenCalled();
    expect(queueStore.incrementRetry).not.toHaveBeenCalled();
  });

  it('leaves an entry that carries its own parent id alone', async () => {
    // Create-shaped inputs need no cache read, so an empty cache is no obstacle.
    const executeMutation = manager['executeMutation'].bind(manager);
    mockClient.mutate.mockResolvedValue({ data: {} });

    const create = makeQueuedMutation({
      id: 'add-1',
      ...queuedMutationFor(AddItemToShoppingListDocument),
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [{ itemName: 'Milk', quantity: 1, clientId: 'c-1' }],
        },
      },
    });

    await expect(executeMutation(create)).resolves.toBeDefined();
  });
});
