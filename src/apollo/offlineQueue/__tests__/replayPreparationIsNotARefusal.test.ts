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
import { gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import {
  AddItemToShoppingListDocument,
  RemoveItemFromShoppingListDocument,
  ToggleShoppingListItemPurchasedDocument,
  UpdateShoppingListItemQuantityDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type { QueueStore } from '../queueStore';

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
  query: jest.fn(),
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
    getMutationsForUser: jest.fn(() => []),
    resetProcessingToPending: jest.fn(() => 0),
    expireStalePending: jest.fn(() => []),
    cleanupTerminal: jest.fn(() => []),
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

/** A quantity edit naming its unit by a flat id, which only a lookup can re-resolve. */
const quantityEntry = () =>
  makeQueuedMutation({
    id: 'quantity-1',
    ...queuedMutationFor(UpdateShoppingListItemQuantityDocument),
    variables: {
      input: { itemId: 'sli-1', quantity: '2', unitId: 'unit-old' },
    },
  });

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
    // A refusal named the unit retired, and the lookup for its current id
    // fails on the device's side.
    mockClient.cache.writeFragment({
      fragment: gql`
        fragment RetiredUnit on Unit {
          id
          symbol
        }
      `,
      data: { __typename: 'Unit', id: 'unit-old', symbol: 'tbsp' },
    });
    mockClient.query.mockRejectedValue(new Error('Network request failed'));
    const entry = quantityEntry();
    manager['staleReferenceRetried'].add(entry.id);
    const executeMutation = manager['executeMutation'].bind(manager);

    await expect(executeMutation(entry)).rejects.toBeInstanceOf(
      ReplayNotPreparedError,
    );
    expect(mockClient.mutate).not.toHaveBeenCalled();
  });

  it('classifies as a deferral that keeps the entry, not a permanent refusal', () => {
    const queueError = classifyError(
      new ReplayNotPreparedError(
        operationNameOf(ToggleShoppingListItemPurchasedDocument),
        new Error('Network request failed'),
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

  it('sends an entry that needs no lookup', async () => {
    // Nothing is read to prepare a create, so an empty cache is no obstacle.
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

describe('a delete after an edit to the same row', () => {
  it('reaches the server as queued, and nothing brings the row back', async () => {
    jest.clearAllMocks();
    (useStore.getState as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      isOnline: true,
      apiReachable: true,
      accessToken: 'token',
    });
    mockClient.cache = makeCache();
    mockClient.mutate.mockResolvedValue({ data: {} });
    const { QueueStore: RealQueueStore } = jest.requireActual<{
      QueueStore: new () => QueueStore;
    }>('../queueStore');
    const store = new RealQueueStore();
    store.clearAllQueues();
    // Offline: the tick queues, then the delete evicts the row.
    store.addMutation({ ...toggleEntry(), createdAt: 1_000 });
    store.addMutation(
      makeQueuedMutation({
        id: 'delete-1',
        ...queuedMutationFor(RemoveItemFromShoppingListDocument),
        variables: { input: { id: 'sli-1' } },
        createdAt: 2_000,
      }),
    );
    (queueStore.getPendingMutationsForUser as jest.Mock).mockImplementation(
      (userId: string) => store.getPendingMutationsForUser(userId),
    );

    await new QueueManager().processQueue();

    const sent = mockClient.mutate.mock.calls.map(
      ([options]: [{ mutation: DocumentNode; variables: unknown }]) => [
        operationNameOf(options.mutation),
        options.variables,
      ],
    );
    expect(sent).toContainEqual([
      operationNameOf(RemoveItemFromShoppingListDocument),
      { input: { id: 'sli-1' } },
    ]);
    // Nothing the drain did brought the deleted row back.
    const rowKey = mockClient.cache.identify({
      __typename: 'ShoppingListItem',
      id: 'sli-1',
    });
    expect(rowKey).toBeDefined();
    expect(mockClient.cache.extract()).not.toHaveProperty([rowKey]);
  });
});

describe('an edit to a row that has left the cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.cache = makeCache();
    mockClient.mutate.mockResolvedValue({ data: {} });
    (useStore.getState as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      isOnline: true,
      apiReachable: true,
      accessToken: 'token',
    });
  });

  const queuedToggle = (id: string, purchased: boolean) =>
    makeQueuedMutation({
      id,
      ...queuedMutationFor(ToggleShoppingListItemPurchasedDocument),
      variables: { input: { id: 'sli-1', purchased, version: 3 } },
    });

  it('is sent as queued', async () => {
    const manager = new QueueManager();

    await manager['executeMutation'](queuedToggle('t-1', true));

    expect(mockClient.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: ToggleShoppingListItemPurchasedDocument,
        variables: { input: { id: 'sli-1', purchased: true, version: 3 } },
      }),
    );
  });

  it('sends two edits to the same uncached row in the order they were made', async () => {
    const { QueueStore: RealQueueStore } = jest.requireActual<{
      QueueStore: new () => QueueStore;
    }>('../queueStore');
    const store = new RealQueueStore();
    store.clearAllQueues();
    store.addMutation({ ...queuedToggle('t-1', true), createdAt: 1_000 });
    store.addMutation({ ...queuedToggle('t-2', false), createdAt: 2_000 });
    (queueStore.getPendingMutationsForUser as jest.Mock).mockImplementation(
      (userId: string) => store.getPendingMutationsForUser(userId),
    );

    await new QueueManager().processQueue();

    const sent = mockClient.mutate.mock.calls.map(
      ([options]: [{ variables: { input: { purchased: boolean } } }]) =>
        options.variables.input.purchased,
    );
    expect(sent).toEqual([true, false]);
  });
});
