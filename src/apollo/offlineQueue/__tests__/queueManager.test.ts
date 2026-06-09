import { Kind, type DocumentNode } from 'graphql';
import type { StoreObject } from '@apollo/client';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { useStore } from '#store';
import {
  QueuedMutation,
  QueueStatus,
  QueueError,
  ProcessingResult,
} from '../types';
import { convertToSyncMutation as convertToSyncMutationFn } from '../convertToSyncMutation';
import {
  classifyError as classifyErrorFn,
  calculateRetryDelay as calculateRetryDelayFn,
} from '../queueErrorPolicy';

// Mock the store module
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
    getInitialState: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock the Apollo client
jest.mock('../../client', () => ({
  client: {
    mutate: jest.fn(),
    cache: {
      readFragment: jest.fn(),
      identify: jest.fn((obj: StoreObject) => `${obj.__typename}:${obj.id}`),
    },
  },
}));

// Mock queueStore
jest.mock('../queueStore', () => ({
  queueStore: {
    getPendingMutationsForUser: jest.fn(() => []),
    updateMutation: jest.fn(() => true),
    removeMutation: jest.fn(() => true),
    incrementRetry: jest.fn(() => true),
    markMutationFailed: jest.fn(() => true),
    cleanupSuccessful: jest.fn(() => 0),
    clearQueueForUser: jest.fn(() => 0),
    setCurrentUserId: jest.fn(),
    clearCurrentUserId: jest.fn(),
    getQueueStats: jest.fn(() => ({
      total: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      authErrors: 0,
    })),
    getMutationsForUser: jest.fn(() => []),
  },
}));

// Mock generateId
jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(() => 'gen-id'),
}));

// Mock the logger
const mockedGetState = useStore.getState as jest.Mock;

/** Build a test QueuedMutation */
function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: `mut-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    operationName: 'TestMutation',
    mutation: { kind: Kind.DOCUMENT, definitions: [] },
    variables: {},
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
    ...overrides,
  };
}

describe('QueueManager', () => {
  let manager: QueueManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    manager = new QueueManager({
      retryDelayMs: 10, // Fast retries for tests
      processingTimeoutMs: 5000,
      batchSize: 5,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // processQueue
  // -------------------------------------------------------------------------
  describe('processQueue', () => {
    it('skips processing when no user is authenticated', async () => {
      mockedGetState.mockReturnValue({
        user: null,
        accessToken: null,
        isOnline: true,
      });

      await manager.processQueue();

      expect(queueStore.getPendingMutationsForUser).not.toHaveBeenCalled();
    });

    it('skips processing when offline', async () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: false,
      });

      await manager.processQueue();

      expect(queueStore.getPendingMutationsForUser).not.toHaveBeenCalled();
    });

    it('skips processing when no access token', async () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: null,
        isOnline: true,
      });

      await manager.processQueue();

      expect(queueStore.getPendingMutationsForUser).not.toHaveBeenCalled();
    });

    it('completes when queue is empty', async () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([]);

      await manager.processQueue();

      expect(queueStore.getPendingMutationsForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(queueStore.cleanupSuccessful).not.toHaveBeenCalled();
    });

    it('prevents concurrent processing', async () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([]);

      // Start two concurrent processQueue calls
      const p1 = manager.processQueue();
      const p2 = manager.processQueue();

      await Promise.all([p1, p2]);

      // getPendingMutationsForUser should only be called once (second call returns early)
      expect(queueStore.getPendingMutationsForUser).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Parent-create FIFO ordering
  // -------------------------------------------------------------------------
  describe('parent-create FIFO ordering', () => {
    /**
     * Instrument processMutation to record start/end interleaving: a
     * concurrent batch shows all starts before the first end, a sequential
     * batch strictly alternates start → end per mutation.
     */
    function instrumentProcessing(events: string[]) {
      manager['processMutation'] = jest.fn(
        async (mutation: QueuedMutation): Promise<ProcessingResult> => {
          events.push(`start:${mutation.id}`);
          await Promise.resolve();
          events.push(`end:${mutation.id}`);
          return { success: true, mutationId: mutation.id };
        },
      );
    }

    beforeEach(() => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
        apiReachable: true,
      });
      manager['validateTokenBeforeReplay'] = jest.fn().mockResolvedValue(true);
    });

    it('replays a batch containing CreateShoppingList strictly in FIFO order', async () => {
      // A list created offline + items added to it (still offline): the items
      // reference the list's client-minted id, so the create MUST land first —
      // entity grouping alone can't see that dependency (each op keys on its
      // own id) and would replay them concurrently.
      const createList = makeMutation({
        id: 'mut-create-list',
        operationName: 'CreateShoppingList',
        variables: { input: { id: 'list-1', name: 'Offline list' } },
      });
      const addA = makeMutation({
        id: 'mut-add-a',
        operationName: 'AddItemToShoppingList',
        variables: { input: { id: 'item-a', shoppingListId: 'list-1' } },
      });
      const addB = makeMutation({
        id: 'mut-add-b',
        operationName: 'AddItemToShoppingList',
        variables: { input: { id: 'item-b', shoppingListId: 'list-1' } },
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([
        createList,
        addA,
        addB,
      ]);

      const events: string[] = [];
      instrumentProcessing(events);

      await manager.processQueue();

      expect(events).toEqual([
        'start:mut-create-list',
        'end:mut-create-list',
        'start:mut-add-a',
        'end:mut-add-a',
        'start:mut-add-b',
        'end:mut-add-b',
      ]);
    });

    it('keeps different-entity mutations concurrent when no parent create is queued', async () => {
      const addA = makeMutation({
        id: 'mut-add-a',
        operationName: 'AddItemToShoppingList',
        variables: { input: { id: 'item-a', shoppingListId: 'list-1' } },
      });
      const addB = makeMutation({
        id: 'mut-add-b',
        operationName: 'AddItemToShoppingList',
        variables: { input: { id: 'item-b', shoppingListId: 'list-1' } },
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([
        addA,
        addB,
      ]);

      const events: string[] = [];
      instrumentProcessing(events);

      await manager.processQueue();

      // Independent items replay concurrently: both start before either ends.
      expect(events).toEqual([
        'start:mut-add-a',
        'start:mut-add-b',
        'end:mut-add-a',
        'end:mut-add-b',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // classifyError (tested through handleMutationError behavior)
  // -------------------------------------------------------------------------
  describe('classifyError', () => {
    // classifyError is now a standalone pure function in queueErrorPolicy.
    const classifyError = classifyErrorFn;

    it('classifies UNAUTHENTICATED as auth error', () => {
      const result = classifyError({
        message: 'Not authenticated',
        extensions: { code: 'UNAUTHENTICATED' },
      });
      expect(result.type).toBe('auth');
      expect(result.retryable).toBe(true);
    });

    it('classifies FORBIDDEN as auth error', () => {
      const result = classifyError({
        message: 'Forbidden',
        extensions: { code: 'FORBIDDEN' },
      });
      expect(result.type).toBe('auth');
      expect(result.retryable).toBe(true);
    });

    it('classifies "expired" message as auth error', () => {
      const result = classifyError({ message: 'Token expired' });
      expect(result.type).toBe('auth');
    });

    it('classifies "unauthorized" message as auth error', () => {
      const result = classifyError({ message: 'Unauthorized access' });
      expect(result.type).toBe('auth');
    });

    it('classifies network errors', () => {
      const result = classifyError({ message: 'Network error occurred' });
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('classifies timeout errors', () => {
      const result = classifyError({ message: 'Request timeout' });
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('classifies ECONNREFUSED as network error', () => {
      const result = classifyError({ message: 'connect ECONNREFUSED' });
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('classifies 5xx as server error', () => {
      const result = classifyError({
        message: 'Internal server error',
        networkError: { statusCode: 500 },
      });
      expect(result.type).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('classifies 503 as server error', () => {
      const result = classifyError({
        message: 'Service unavailable',
        networkError: { statusCode: 503 },
      });
      expect(result.type).toBe('server');
      expect(result.retryable).toBe(true);
    });

    it('classifies unknown/client errors as non-retryable', () => {
      const result = classifyError({
        message: 'Validation error: field X is required',
      });
      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(false);
    });

    it('includes timestamp in classified error', () => {
      const before = Date.now();
      const result = classifyError({ message: 'test' });
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  // -------------------------------------------------------------------------
  // mergeMoveItemMutations
  // -------------------------------------------------------------------------
  describe('mergeMoveItemMutations', () => {
    let mergeMoveItemMutations: (mutations: QueuedMutation[]) => {
      merged: QueuedMutation[];
      removed: string[];
    };

    beforeEach(() => {
      mergeMoveItemMutations = manager['mergeMoveItemMutations'].bind(manager);
    });

    it('merges multiple move mutations for the same item', () => {
      const move1 = makeMutation({
        id: 'move-1',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A', afterId: 'x' } },
      });
      const move2 = makeMutation({
        id: 'move-2',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A', afterId: 'y' } },
      });

      const { merged, removed } = mergeMoveItemMutations([move1, move2]);

      expect(removed).toEqual(['move-1']);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('move-2');
    });

    it('keeps move mutations for different items', () => {
      const moveA = makeMutation({
        id: 'move-a',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A' } },
      });
      const moveB = makeMutation({
        id: 'move-b',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-B' } },
      });

      const { merged, removed } = mergeMoveItemMutations([moveA, moveB]);

      expect(removed).toEqual([]);
      expect(merged).toHaveLength(2);
    });

    it('preserves non-move mutations in order', () => {
      const create = makeMutation({
        id: 'create-1',
        operationName: 'AddItemToShoppingList',
      });
      const move = makeMutation({
        id: 'move-1',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A' } },
      });

      const { merged, removed } = mergeMoveItemMutations([create, move]);

      expect(removed).toEqual([]);
      expect(merged).toHaveLength(2);
      // Non-move mutations come first, then move mutations
      expect(merged[0].id).toBe('create-1');
      expect(merged[1].id).toBe('move-1');
    });

    it('handles empty input', () => {
      const { merged, removed } = mergeMoveItemMutations([]);
      expect(merged).toEqual([]);
      expect(removed).toEqual([]);
    });

    it('handles move mutations without itemId', () => {
      const move = makeMutation({
        id: 'move-no-id',
        operationName: 'MoveShoppingListItem',
        variables: { input: {} },
      });

      const { merged, removed } = mergeMoveItemMutations([move]);

      expect(removed).toEqual([]);
      expect(merged).toHaveLength(1);
    });

    it('keeps three moves for same item, only latest survives', () => {
      const move1 = makeMutation({
        id: 'move-1',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A', afterId: 'a' } },
      });
      const move2 = makeMutation({
        id: 'move-2',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A', afterId: 'b' } },
      });
      const move3 = makeMutation({
        id: 'move-3',
        operationName: 'MoveShoppingListItem',
        variables: { input: { itemId: 'item-A', afterId: 'c' } },
      });

      const { merged, removed } = mergeMoveItemMutations([move1, move2, move3]);

      expect(removed).toContain('move-1');
      expect(removed).toContain('move-2');
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('move-3');
      expect(merged[0].variables.input.afterId).toBe('c');
    });
  });

  // -------------------------------------------------------------------------
  // handleMutationError (via processMutation)
  // -------------------------------------------------------------------------
  describe('handleMutationError', () => {
    let handleMutationError: (
      mutation: QueuedMutation,
      error: unknown,
    ) => Promise<ProcessingResult>;

    beforeEach(() => {
      handleMutationError = manager['handleMutationError'].bind(manager);
      // Default: online
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });
    });

    it('marks non-retryable errors as failed immediately', async () => {
      const mutation = makeMutation({ id: 'fail-1', retryCount: 0 });
      const error = { message: 'Validation error: field X is required' };

      const result = await handleMutationError(mutation, error);

      expect(result.success).toBe(false);
      expect(queueStore.markMutationFailed).toHaveBeenCalledWith(
        'fail-1',
        expect.objectContaining({ type: 'unknown', retryable: false }),
      );
    });

    it('defers a transient network error to PENDING after max retries (local-first — not lost)', async () => {
      const mutation = makeMutation({
        id: 'maxed-out',
        retryCount: 3,
        maxRetries: 3,
      });
      const error = { message: 'Network error' };

      const result = await handleMutationError(mutation, error);

      expect(result.success).toBe(false);
      // A transient network error must NOT permanently fail the mutation — it
      // stays PENDING (reset retryCount) for the next drain/recovery.
      expect(queueStore.markMutationFailed).not.toHaveBeenCalled();
      expect(queueStore.updateMutation).toHaveBeenCalledWith(
        'maxed-out',
        expect.objectContaining({
          status: QueueStatus.PENDING,
          retryCount: 0,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------
  describe('event handlers', () => {
    it('onLogout clears queue for user', () => {
      manager.onLogout('user-1');

      expect(queueStore.clearQueueForUser).toHaveBeenCalledWith('user-1');
      expect(queueStore.clearCurrentUserId).toHaveBeenCalled();
    });

    it('onUserChange clears old user queue and sets new user', () => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-2' },
      });
      manager.onUserChange('user-2', 'user-1');

      expect(queueStore.clearQueueForUser).toHaveBeenCalledWith('user-1');
      expect(queueStore.setCurrentUserId).toHaveBeenCalledWith('user-2');
    });

    it('onUserChange does not clear queue when same user', () => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      manager.onUserChange('user-1', 'user-1');

      expect(queueStore.clearQueueForUser).not.toHaveBeenCalled();
    });

    it('onUserChange does not clear queue when no previous user', () => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      manager.onUserChange('user-1', null);

      expect(queueStore.clearQueueForUser).not.toHaveBeenCalled();
      expect(queueStore.setCurrentUserId).toHaveBeenCalledWith('user-1');
    });

    it('getStats delegates to queueStore.getQueueStats', () => {
      manager.getStats('user-1');
      expect(queueStore.getQueueStats).toHaveBeenCalledWith('user-1');
    });
  });

  // -------------------------------------------------------------------------
  // processMutation
  // -------------------------------------------------------------------------
  describe('processMutation', () => {
    let processMutation: (
      mutation: QueuedMutation,
    ) => Promise<ProcessingResult>;
    const { client } = require('../../client');

    beforeEach(() => {
      processMutation = manager['processMutation'].bind(manager);
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });
    });

    it('marks mutation as processing, then success on completion', async () => {
      const mutation = makeMutation({ id: 'proc-1' });
      client.mutate.mockResolvedValue({
        data: { syncPantryItem: { item: {}, wasCreated: false } },
      });

      jest.useRealTimers();
      const result = await processMutation(mutation);
      jest.useFakeTimers();

      expect(result.success).toBe(true);
      expect(queueStore.updateMutation).toHaveBeenCalledWith('proc-1', {
        status: QueueStatus.PROCESSING,
      });
      expect(queueStore.updateMutation).toHaveBeenCalledWith('proc-1', {
        status: QueueStatus.SUCCESS,
        processedAt: expect.any(Number),
      });
    });

    it('handles mutation failure', async () => {
      const mutation = makeMutation({
        id: 'proc-fail',
        retryCount: 3,
        maxRetries: 3,
      });
      client.mutate.mockRejectedValue(new Error('Server error'));

      jest.useRealTimers();
      const result = await processMutation(mutation);
      jest.useFakeTimers();

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  describe('createBatches', () => {
    let createBatches: <T>(items: T[], size: number) => T[][];

    beforeEach(() => {
      createBatches = manager['createBatches'].bind(manager);
    });

    it('splits items into batches of given size', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const batches = createBatches(items, 3);
      expect(batches).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('handles empty array', () => {
      expect(createBatches([], 5)).toEqual([]);
    });

    it('handles single batch', () => {
      expect(createBatches([1, 2], 5)).toEqual([[1, 2]]);
    });
  });

  describe('groupByEntity', () => {
    let groupByEntity: (mutations: QueuedMutation[]) => {
      independent: QueuedMutation[];
      entityGroups: QueuedMutation[][];
    };

    beforeEach(() => {
      groupByEntity = manager['groupByEntity'].bind(manager);
    });

    it('groups mutations by entity id', () => {
      const m1 = makeMutation({
        id: 'a',
        variables: { input: { id: 'entity-1' } },
      });
      const m2 = makeMutation({
        id: 'b',
        variables: { input: { id: 'entity-1' } },
      });
      const m3 = makeMutation({
        id: 'c',
        variables: { input: { id: 'entity-2' } },
      });

      const { independent, entityGroups } = groupByEntity([m1, m2, m3]);

      // entity-2 is independent (single mutation)
      expect(independent).toHaveLength(1);
      expect(independent[0].id).toBe('c');

      // entity-1 has 2 mutations, should be a group
      expect(entityGroups).toHaveLength(1);
      expect(entityGroups[0]).toHaveLength(2);
    });

    it('treats mutations without identifiable entity as independent', () => {
      const m1 = makeMutation({ id: 'x', variables: {} });
      const m2 = makeMutation({ id: 'y', variables: {} });

      const { independent, entityGroups } = groupByEntity([m1, m2]);

      expect(independent).toHaveLength(2);
      expect(entityGroups).toHaveLength(0);
    });
  });

  describe('calculateRetryDelay', () => {
    // calculateRetryDelay is now a standalone function taking the base delay
    // explicitly; the manager passes config.retryDelayMs (10 in this suite).
    const calculateRetryDelay = (retryCount: number) =>
      calculateRetryDelayFn(retryCount, 10);

    it('uses exponential backoff', () => {
      // With retryDelayMs = 10
      // retryCount 0 -> 10 * 2^0 = 10 + jitter
      // retryCount 1 -> 10 * 2^1 = 20 + jitter
      // retryCount 2 -> 10 * 2^2 = 40 + jitter
      const delay0 = calculateRetryDelay(0);
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);

      expect(delay0).toBeGreaterThanOrEqual(10);
      expect(delay0).toBeLessThanOrEqual(510); // 10 + 500 jitter max
      expect(delay1).toBeGreaterThanOrEqual(20);
      expect(delay2).toBeGreaterThanOrEqual(40);
    });

    it('caps at 30 seconds', () => {
      const delay = calculateRetryDelay(20); // 10 * 2^20 would be huge
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  // -------------------------------------------------------------------------
  // convertToSyncMutation
  // -------------------------------------------------------------------------
  describe('convertToSyncMutation', () => {
    let convertToSyncMutation: (mutation: QueuedMutation) => {
      syncMutation: DocumentNode;
      syncVariables: Record<string, unknown>;
    };
    const { client: mockClient } = require('../../client');

    beforeEach(() => {
      // convertToSyncMutation is now a standalone function taking cache readers;
      // the manager still owns the cache backfill (readPantryId/readShoppingListId),
      // so inject those to preserve the backfill-from-cache behavior under test.
      const readers = {
        readPantryId: manager['readPantryId'].bind(manager),
        readShoppingListId: manager['readShoppingListId'].bind(manager),
      };
      convertToSyncMutation = mutation =>
        convertToSyncMutationFn(mutation, readers);
    });

    // The current 1-arg sync API: variables ride inside `input`, and the output
    // is `{ input: { clientId, ... } }` (clientId INSIDE input).
    const wrapper = (syncVariables: Record<string, unknown>) =>
      syncVariables.input as Record<string, unknown>;

    it('converts CreatePantryItem → SyncPantryItem (id → clientId inside input)', () => {
      const mutation = makeMutation({
        operationName: 'CreatePantryItem',
        // Real CreatePantryItemInput carries pantryId + item:{name}.
        variables: {
          input: { id: 'item-1', pantryId: 'pan-1', item: { name: 'Milk' } },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('item-1');
      expect(input.pantryId).toBe('pan-1');
      expect(input.item).toEqual({ name: 'Milk' });
      expect(input.id).toBeUndefined();
    });

    // UpdatePantryItemInput has no pantryId and sends a flat itemName, but
    // SyncPantryItemInput requires pantryId and takes item:{name}. The converter
    // backfills pantryId from the cached PantryItem and folds itemName into item.
    it('converts UpdatePantryItem → SyncPantryItem (backfills pantryId, folds itemName→item)', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'item-2',
        pantryId: 'pan-2',
      });
      const mutation = makeMutation({
        operationName: 'UpdatePantryItem',
        variables: {
          input: {
            id: 'item-2',
            itemName: 'Eggs',
            storage: { storageState: 'OPENED' },
            version: 4,
          },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('item-2');
      expect(input.version).toBe(4);
      // pantryId backfilled from cache (required by SyncPantryItemInput).
      expect(input.pantryId).toBe('pan-2');
      // itemName folded into item:{name}; no flat itemName forwarded.
      expect(input.item).toEqual({ name: 'Eggs' });
      expect(input.itemName).toBeUndefined();
      expect(input.storage).toEqual({ storageState: 'OPENED' });
    });

    it('throws when pantryId cannot be resolved for a pantry-item sync', () => {
      mockClient.cache.readFragment.mockReturnValue(null);
      const mutation = makeMutation({
        operationName: 'UpdatePantryItem',
        variables: { input: { id: 'orphan-item', itemName: 'Ghost' } },
      });
      expect(() => convertToSyncMutation(mutation)).toThrow(
        'Cannot sync UpdatePantryItem: pantryId not found',
      );
    });

    // Granular deltas (adjust/restock/consume/open/waste) wrap the original
    // input verbatim under `input.input` and add the client-minted operationId
    // (carried on context) so the server dedups the replay.
    it('converts AdjustPantryItemQuantity → SyncAdjustPantryItemQuantity (wraps input + operationId from context)', () => {
      const mutation = makeMutation({
        operationName: 'AdjustPantryItemQuantity',
        variables: {
          input: { id: 'item-1', newQuantity: 3, reason: 'recount' },
        },
        context: { localFirst: true, operationId: 'op-cuid-1' },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.operationId).toBe('op-cuid-1');
      expect(input.input).toEqual({
        id: 'item-1',
        newQuantity: 3,
        reason: 'recount',
      });
    });

    it('throws when a granular delta is queued without an operationId', () => {
      const mutation = makeMutation({
        operationName: 'RestockPantryItem',
        variables: { input: { id: 'item-1', quantity: 5 } },
        context: { localFirst: true },
      });
      expect(() => convertToSyncMutation(mutation)).toThrow(
        'Cannot sync RestockPantryItem: missing operationId',
      );
    });

    // UpdatePantryItemQuantityInput carries the item id as `pantryItemId`, the
    // quantity as a raw string, and the unit as a flat `unitId` — none of which
    // align with SyncPantryItemInput. The dedicated builder maps each field.
    it('converts UpdatePantryItemQuantity → SyncPantryItem (pantryItemId → clientId, string → Float, unitId → unit)', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'item-q',
        pantryId: 'pan-q',
      });
      const mutation = makeMutation({
        operationName: 'UpdatePantryItemQuantity',
        variables: {
          input: {
            pantryItemId: 'item-q',
            quantity: '2.5',
            unitId: 'unit-7',
            version: 3,
          },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('item-q');
      expect(input.pantryId).toBe('pan-q');
      expect(input.quantity).toBe(2.5);
      expect(input.unit).toEqual({ unitId: 'unit-7' });
      expect(input.version).toBe(3);
      expect(input.pantryItemId).toBeUndefined();
    });

    it('omits quantity/unit from the quantity sync when absent or unparsable', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'item-q2',
        pantryId: 'pan-q2',
      });
      const mutation = makeMutation({
        operationName: 'UpdatePantryItemQuantity',
        variables: {
          input: { pantryItemId: 'item-q2', quantity: '', unitId: null },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('item-q2');
      expect(input.quantity).toBeUndefined();
      expect(input.unit).toBeUndefined();
    });

    it('converts DeletePantryItem → SyncDeletePantryItem', () => {
      const mutation = makeMutation({
        operationName: 'DeletePantryItem',
        variables: { input: { id: 'item-3', version: 2 } },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('item-3');
      expect(input.version).toBe(2);
    });

    it('converts AddItemToShoppingList → SyncShoppingListItem ({ clientId, item })', () => {
      const mutation = makeMutation({
        operationName: 'AddItemToShoppingList',
        variables: {
          input: {
            id: 'sl-1',
            shoppingListId: 'list-1',
            itemName: 'Bread',
            quantity: 2,
          },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('sl-1');
      const item = input.item as Record<string, unknown>;
      expect(item.shoppingListId).toBe('list-1');
      expect(item.itemName).toBe('Bread');
      // FlexibleQuantity scalar — passed through, no unitId needed.
      expect(item.quantity).toBe(2);
    });

    it('converts UpdateShoppingListItemQuantity with cache read', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'sl-item-1',
        shoppingList: { id: 'list-99' },
      });
      const mutation = makeMutation({
        operationName: 'UpdateShoppingListItemQuantity',
        variables: {
          input: { itemId: 'sl-item-1', quantity: '5', version: 3 },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('sl-item-1');
      const item = input.item as Record<string, unknown>;
      expect(item.shoppingListId).toBe('list-99');
      expect(item.quantity).toBe('5');
      expect(item.version).toBe(3);
    });

    // UpdateShoppingListItemQuantity sends a flat `unitId`, but
    // SyncShoppingListItemInput.unit is a UnitSpecInput object — the converter
    // normalizes the flat scalar into `unit` so an offline unit change isn't lost.
    it('normalizes a flat unitId into unit:{unitId} for a quantity sync', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'sl-item-1',
        shoppingList: { id: 'list-99' },
      });
      const mutation = makeMutation({
        operationName: 'UpdateShoppingListItemQuantity',
        variables: {
          input: { itemId: 'sl-item-1', quantity: '5', unitId: 'unit-7' },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const item = wrapper(syncVariables).item as Record<string, unknown>;
      expect(item.unit).toEqual({ unitId: 'unit-7' });
    });

    it('converts ToggleShoppingListItemPurchased with cache read', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'sl-item-2',
        shoppingList: { id: 'list-88' },
      });
      const mutation = makeMutation({
        operationName: 'ToggleShoppingListItemPurchased',
        variables: { input: { id: 'sl-item-2', purchased: true } },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('sl-item-2');
      const item = input.item as Record<string, unknown>;
      expect(item.shoppingListId).toBe('list-88');
      expect(item.purchaseTracking).toEqual({ isPurchased: true });
    });

    it('throws when cache has no shoppingList data for quantity update', () => {
      mockClient.cache.readFragment.mockReturnValue(null);
      const mutation = makeMutation({
        operationName: 'UpdateShoppingListItemQuantity',
        variables: { input: { itemId: 'missing-item', quantity: '2' } },
      });
      expect(() => convertToSyncMutation(mutation)).toThrow(
        'Cannot sync UpdateShoppingListItemQuantity',
      );
    });

    it('converts RemoveItemFromShoppingList → SyncDeleteShoppingListItem', () => {
      const mutation = makeMutation({
        operationName: 'RemoveItemFromShoppingList',
        variables: { input: { id: 'del-item', version: 5 } },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('del-item');
      expect(input.version).toBe(5);
    });

    it('converts MoveShoppingListItem → SyncMoveShoppingListItem (afterItemId → afterId)', () => {
      const mutation = makeMutation({
        operationName: 'MoveShoppingListItem',
        variables: {
          input: {
            itemId: 'mv-1',
            afterItemId: 'a',
            beforeItemId: 'b',
            version: 2,
          },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = wrapper(syncVariables);
      expect(input.clientId).toBe('mv-1');
      expect(input.afterId).toBe('a');
      expect(input.beforeId).toBe('b');
      expect(input.version).toBe(2);
    });

    it('falls back to original mutation for unknown operation', () => {
      const originalMutation: DocumentNode = {
        kind: Kind.DOCUMENT,
        definitions: [],
      };
      const mutation = makeMutation({
        operationName: 'UnknownOperation',
        mutation: originalMutation,
        variables: { foo: 'bar' },
      });
      const { syncMutation, syncVariables } = convertToSyncMutation(mutation);
      expect(syncMutation).toBe(originalMutation);
      expect(syncVariables.foo).toBe('bar');
    });

    it('leaves clientId undefined when the input has no id (no temp- fallback)', () => {
      // temp- ids are rejected by the server now (client mints permanent cuids);
      // a missing id surfaces as undefined rather than a fabricated temp- id.
      const mutation = makeMutation({
        operationName: 'CreatePantryItem',
        variables: {
          input: { pantryId: 'pan-1', item: { name: 'No ID item' } },
        },
      });
      const { syncVariables } = convertToSyncMutation(mutation);
      const input = syncVariables.input as Record<string, unknown>;
      expect(input.clientId).toBeUndefined();
    });

    // Specialized single-item creates map onto the same sync mutations as their
    // canonical counterparts (they create the same entity from the same fields).
    it('converts BarcodeCreatePantryItem → SyncPantryItem', () => {
      const mutation = makeMutation({
        operationName: 'BarcodeCreatePantryItem',
        variables: {
          input: { id: 'p-1', pantryId: 'pan-1', itemId: 'cat-1', quantity: 2 },
        },
      });
      const input = wrapper(convertToSyncMutation(mutation).syncVariables);
      expect(input.clientId).toBe('p-1');
      expect(input.pantryId).toBe('pan-1');
      expect(input.itemId).toBe('cat-1');
      expect(input.id).toBeUndefined();
    });

    it('converts BarcodeAddItemToShoppingList → SyncShoppingListItem (keeps brand + netWeight)', () => {
      const mutation = makeMutation({
        operationName: 'BarcodeAddItemToShoppingList',
        variables: {
          input: {
            id: 'sl-9',
            shoppingListId: 'list-1',
            itemId: 'cat-1',
            itemName: 'Cereal',
            quantity: 1,
            brand: { brandId: 'b1' },
            netWeight: { netWeight: 500 },
          },
        },
      });
      const input = wrapper(convertToSyncMutation(mutation).syncVariables);
      expect(input.clientId).toBe('sl-9');
      const item = input.item as Record<string, unknown>;
      expect(item.shoppingListId).toBe('list-1');
      expect(item.itemName).toBe('Cereal');
      // Not dropped on sync replay (would be lost if it fell back to replay-original).
      expect(item.brand).toEqual({ brandId: 'b1' });
      expect(item.netWeight).toEqual({ netWeight: 500 });
    });

    it('converts AddItemToShoppingListFromFilteredPantry → SyncShoppingListItem', () => {
      const mutation = makeMutation({
        operationName: 'AddItemToShoppingListFromFilteredPantry',
        variables: {
          input: { id: 'sl-10', shoppingListId: 'list-1', itemId: 'cat-2' },
        },
      });
      const input = wrapper(convertToSyncMutation(mutation).syncVariables);
      expect(input.clientId).toBe('sl-10');
      const item = input.item as Record<string, unknown>;
      expect(item.shoppingListId).toBe('list-1');
      expect(item.itemId).toBe('cat-2');
    });

    it('converts AddItemToShoppingListFromPantryItem → SyncShoppingListItem', () => {
      const mutation = makeMutation({
        operationName: 'AddItemToShoppingListFromPantryItem',
        variables: {
          input: {
            id: 'sl-11',
            shoppingListId: 'list-1',
            itemId: 'cat-3',
            itemName: 'Rice',
            quantity: 3,
          },
        },
      });
      const input = wrapper(convertToSyncMutation(mutation).syncVariables);
      expect(input.clientId).toBe('sl-11');
      const item = input.item as Record<string, unknown>;
      expect(item.itemName).toBe('Rice');
      expect(item.quantity).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // executeMutation - sync replay and conflict handling
  // -------------------------------------------------------------------------
  describe('executeMutation', () => {
    let executeSyncMutation: (mutation: QueuedMutation) => Promise<unknown>;
    const { client: mockClient } = require('../../client');

    beforeEach(() => {
      executeSyncMutation = manager['executeMutation'].bind(manager);
    });

    it('handles conflict in sync response', async () => {
      mockClient.mutate.mockResolvedValue({
        data: {
          syncPantryItem: {
            item: { id: 'server-1' },
            wasCreated: false,
            conflict: { message: 'Version mismatch' },
          },
        },
      });

      mockClient.cache.readFragment.mockReturnValue({
        id: 'item-1',
        pantryId: 'pan-1',
      });
      jest.useRealTimers();
      const mutation = makeMutation({
        operationName: 'UpdatePantryItem',
        variables: { input: { id: 'item-1' } },
      });
      const result = await executeSyncMutation(mutation);
      jest.useFakeTimers();

      expect(result).toBeDefined();
    });

    it('throws when mutate returns an error', async () => {
      mockClient.mutate.mockResolvedValue({
        error: new Error('Server error'),
      });

      jest.useRealTimers();
      const mutation = makeMutation({
        operationName: 'CreatePantryItem',
        variables: { input: { id: 'item-1', pantryId: 'pan-1' } },
      });
      await expect(executeSyncMutation(mutation)).rejects.toThrow(
        'Server error',
      );
      jest.useFakeTimers();
    });
  });

  // -------------------------------------------------------------------------
  // onOnline
  // -------------------------------------------------------------------------
  describe('onOnline', () => {
    it('triggers queue processing', () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([]);

      // Should not throw
      manager.onOnline();
    });
  });

  // -------------------------------------------------------------------------
  // onOffline
  // -------------------------------------------------------------------------
  describe('onOffline', () => {
    it('logs offline message without error', () => {
      expect(() => manager.onOffline()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // onUserChange - online triggers processQueue
  // -------------------------------------------------------------------------
  describe('onUserChange triggers processQueue when online', () => {
    it('starts processing when online', () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-new' },
        accessToken: 'token',
        isOnline: true,
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([]);

      manager.onUserChange('user-new', null);

      expect(queueStore.setCurrentUserId).toHaveBeenCalledWith('user-new');
    });

    it('does not process queue when null newUserId', () => {
      mockedGetState.mockReturnValue({
        isOnline: true,
      });

      manager.onUserChange(null, 'old-user');

      // Should not try to set current user id
      expect(queueStore.setCurrentUserId).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getStats without userId
  // -------------------------------------------------------------------------
  describe('getStats without userId', () => {
    it('calls getQueueStats with undefined', () => {
      manager.getStats();
      expect(queueStore.getQueueStats).toHaveBeenCalledWith(undefined);
    });
  });

  // -------------------------------------------------------------------------
  // processQueue - full integration with mutations
  // -------------------------------------------------------------------------
  describe('processQueue full flow', () => {
    const { client: mockClient } = require('../../client');

    it('processes mutations in batches and cleans up', async () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });

      const mutations = [
        makeMutation({
          id: 'mut-1',
          userId: 'user-1',
          operationName: 'CreatePantryItem',
          variables: { input: { id: 'item-1' } },
        }),
      ];
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue(
        mutations,
      );

      mockClient.mutate.mockResolvedValue({
        data: {
          syncPantryItem: {
            item: { id: 'item-1' },
            wasCreated: true,
            serverId: 'srv-1',
            clientId: 'item-1',
          },
        },
      });

      jest.useRealTimers();
      await manager.processQueue();
      jest.useFakeTimers();

      expect(queueStore.cleanupSuccessful).toHaveBeenCalled();
    });

    it('breaks processing when going offline mid-batch', async () => {
      let callCount = 0;
      mockedGetState.mockImplementation(() => {
        callCount++;
        // First call = processQueue check, second = validateToken, third = batch online check
        if (callCount <= 2) {
          return {
            user: { id: 'user-1' },
            accessToken: 'token',
            isOnline: true,
          };
        }
        return {
          user: { id: 'user-1' },
          accessToken: 'token',
          isOnline: false,
        };
      });

      const mutations = [makeMutation({ id: 'mut-1', userId: 'user-1' })];
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue(
        mutations,
      );

      jest.useRealTimers();
      await manager.processQueue();
      jest.useFakeTimers();

      // Should not process mutation since went offline
      expect(queueStore.updateMutation).not.toHaveBeenCalledWith(
        'mut-1',
        expect.objectContaining({ status: QueueStatus.PROCESSING }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // validateTokenBeforeReplay
  // -------------------------------------------------------------------------
  describe('validateTokenBeforeReplay', () => {
    let validateTokenBeforeReplay: () => Promise<boolean>;

    beforeEach(() => {
      validateTokenBeforeReplay =
        manager['validateTokenBeforeReplay'].bind(manager);
    });

    it('returns true when accessToken exists', async () => {
      mockedGetState.mockReturnValue({ accessToken: 'valid-token' });
      const result = await validateTokenBeforeReplay();
      expect(result).toBe(true);
    });

    it('returns false when no accessToken', async () => {
      mockedGetState.mockReturnValue({ accessToken: null });
      const result = await validateTokenBeforeReplay();
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // handleAuthError
  // -------------------------------------------------------------------------
  describe('handleAuthError', () => {
    let handleAuthError: (
      mutation: QueuedMutation,
      error: QueueError,
    ) => Promise<ProcessingResult>;

    beforeEach(() => {
      handleAuthError = manager['handleAuthError'].bind(manager);
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
      });
    });

    it('retries mutation after successful token refresh', async () => {
      const { client: mockClient } = require('../../client');
      mockClient.mutate.mockResolvedValue({
        data: { syncPantryItem: { item: {}, wasCreated: false } },
      });

      jest.useRealTimers();
      const mutation = makeMutation({ id: 'auth-retry-1' });
      const error: QueueError = {
        type: 'auth',
        message: 'Unauthorized',
        timestamp: Date.now(),
        retryable: true,
      };
      const result = await handleAuthError(mutation, error);
      jest.useFakeTimers();

      // Token exists so validateTokenBeforeReplay returns true
      expect(result.success).toBe(true);
    });

    it('marks as failed when token refresh fails', async () => {
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: null, // No token = validate fails
        isOnline: true,
      });

      jest.useRealTimers();
      const mutation = makeMutation({ id: 'auth-fail-1' });
      const error: QueueError = {
        type: 'auth',
        message: 'Unauthorized',
        timestamp: Date.now(),
        retryable: true,
      };
      const result = await handleAuthError(mutation, error);
      jest.useFakeTimers();

      expect(result.success).toBe(false);
      expect(queueStore.markMutationFailed).toHaveBeenCalledWith(
        'auth-fail-1',
        expect.objectContaining({ type: 'auth' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // setFailureHandler / invokeFailureHandler / extractEntityInfo
  // -------------------------------------------------------------------------
  describe('setFailureHandler and failure invocation', () => {
    let invokeFailureHandler: (
      mutation: QueuedMutation,
      error: QueueError,
    ) => void;
    let extractEntityInfo: (mutation: QueuedMutation) => {
      entityType: string | null;
      entityId: string | null;
    };

    beforeEach(() => {
      invokeFailureHandler = manager['invokeFailureHandler'].bind(manager);
      extractEntityInfo = manager['extractEntityInfo'].bind(manager);
    });

    it('stores the failure handler via setFailureHandler', () => {
      const handler = jest.fn();
      manager.setFailureHandler(handler);

      const mutation = makeMutation({
        id: 'fail-h-1',
        operationName: 'UpdatePantryItem',
        variables: { input: { id: 'item-1' } },
      });
      invokeFailureHandler(mutation, {
        type: 'unknown',
        message: 'fail',
        timestamp: Date.now(),
        retryable: false,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationId: 'fail-h-1',
          operationName: 'UpdatePantryItem',
          entityType: 'PantryItem',
          entityId: 'item-1',
        }),
      );
    });

    it('replaces previous handler when called again', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      manager.setFailureHandler(handler1);
      manager.setFailureHandler(handler2);

      const mutation = makeMutation({
        id: 'replace-1',
        operationName: 'TestMutation',
      });
      invokeFailureHandler(mutation, {
        type: 'unknown',
        message: 'fail',
        timestamp: Date.now(),
        retryable: false,
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('does not crash when no failure handler is registered', () => {
      // Manager has no handler set (fresh instance)
      const mutation = makeMutation({ id: 'no-handler-1' });
      expect(() => {
        invokeFailureHandler(mutation, {
          type: 'unknown',
          message: 'fail',
          timestamp: Date.now(),
          retryable: false,
        });
      }).not.toThrow();
    });

    it('catches and logs handler errors without crashing', () => {
      const { logger } = require('#/utils/environment');
      const throwingHandler = jest.fn(() => {
        throw new Error('handler boom');
      });
      manager.setFailureHandler(throwingHandler);

      const mutation = makeMutation({ id: 'throw-1' });
      expect(() => {
        invokeFailureHandler(mutation, {
          type: 'unknown',
          message: 'fail',
          timestamp: Date.now(),
          retryable: false,
        });
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Queue: Failure handler threw an error:',
        expect.any(Error),
      );
    });

    it('passes error object in FailedMutationInfo', () => {
      const handler = jest.fn();
      manager.setFailureHandler(handler);

      const error: QueueError = {
        type: 'network',
        message: 'timeout',
        code: 'TIMEOUT',
        timestamp: 123,
        retryable: true,
      };
      const mutation = makeMutation({
        id: 'err-pass-1',
        operationName: 'CreatePantryItem',
        variables: { input: { id: 'p1' } },
      });
      invokeFailureHandler(mutation, error);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });

    // --- extractEntityInfo ---
    describe('extractEntityInfo', () => {
      it('extracts PantryItem from pantry operations', () => {
        const mutation = makeMutation({
          operationName: 'UpdatePantryItem',
          variables: { input: { id: 'pi-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItem',
          entityId: 'pi-1',
        });
      });

      it('extracts PantryItem from Pantry-prefixed operations', () => {
        const mutation = makeMutation({
          operationName: 'CreatePantry',
          variables: { input: { id: 'p-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItem',
          entityId: 'p-1',
        });
      });

      it('extracts PantryItemBatch from batch operations', () => {
        const mutation = makeMutation({
          operationName: 'OpenPantryItemBatch',
          variables: { input: { batchId: 'b-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItemBatch',
          entityId: 'b-1',
        });
      });

      it('extracts ShoppingListItem from shopping list operations', () => {
        const mutation = makeMutation({
          operationName: 'ToggleShoppingListItemPurchased',
          variables: { id: 'sli-1' },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'ShoppingListItem',
          entityId: 'sli-1',
        });
      });

      it('extracts ShoppingListItem from ShoppingList-prefixed operations', () => {
        const mutation = makeMutation({
          operationName: 'AddItemToShoppingList',
          variables: { input: { id: 'sli-2' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'ShoppingListItem',
          entityId: 'sli-2',
        });
      });

      it('extracts MealPlanItem from meal plan item operations', () => {
        const mutation = makeMutation({
          operationName: 'UpdateMealPlanItem',
          variables: { input: { id: 'mpi-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'MealPlanItem',
          entityId: 'mpi-1',
        });
      });

      it('extracts MealPlan from meal plan operations (non-item)', () => {
        const mutation = makeMutation({
          operationName: 'CreateMealPlan',
          variables: { input: { id: 'mp-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'MealPlan',
          entityId: 'mp-1',
        });
      });

      it('extracts SavedRecipe from recipe operations', () => {
        const mutation = makeMutation({
          operationName: 'FavoriteRecipe',
          variables: { input: { recipeId: 'r-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'SavedRecipe',
          entityId: 'r-1',
        });
      });

      it('extracts SavedRecipe from Favorite-prefixed operations', () => {
        const mutation = makeMutation({
          operationName: 'UnfavoriteRecipe',
          variables: { input: { recipeId: 'r-2' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'SavedRecipe',
          entityId: 'r-2',
        });
      });

      it('extracts entityId from top-level id variable', () => {
        const mutation = makeMutation({
          operationName: 'DeletePantryItem',
          variables: { id: 'top-1' },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItem',
          entityId: 'top-1',
        });
      });

      it('extracts entityId from input.pantryItemId', () => {
        const mutation = makeMutation({
          operationName: 'UpdatePantryItem',
          variables: { input: { pantryItemId: 'pid-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItem',
          entityId: 'pid-1',
        });
      });

      it('extracts entityId from input.itemId', () => {
        const mutation = makeMutation({
          operationName: 'MoveShoppingListItem',
          variables: { input: { itemId: 'iid-1' } },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'ShoppingListItem',
          entityId: 'iid-1',
        });
      });

      it('extracts entityId from clientId', () => {
        const mutation = makeMutation({
          operationName: 'CreatePantryItem',
          variables: { clientId: 'cid-1' },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItem',
          entityId: 'cid-1',
        });
      });

      it('returns null entityType for unknown operation names', () => {
        const mutation = makeMutation({
          operationName: 'DoSomethingRandom',
          variables: { id: 'x' },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: null,
          entityId: 'x',
        });
      });

      it('returns null entityId when no recognizable variables exist', () => {
        const mutation = makeMutation({
          operationName: 'UpdatePantryItem',
          variables: { foo: 'bar' },
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: 'PantryItem',
          entityId: null,
        });
      });

      it('returns nulls when variables are undefined', () => {
        const mutation = makeMutation({
          operationName: 'UnknownOp',
          variables: undefined,
        });
        expect(extractEntityInfo(mutation)).toEqual({
          entityType: null,
          entityId: null,
        });
      });
    });

    // --- Integration: handleMutationError invokes failure handler ---
    describe('handleMutationError invokes failure handler', () => {
      let handleMutationError: (
        mutation: QueuedMutation,
        error: unknown,
      ) => Promise<ProcessingResult>;

      beforeEach(() => {
        handleMutationError = manager['handleMutationError'].bind(manager);
        mockedGetState.mockReturnValue({
          user: { id: 'user-1' },
          accessToken: 'token',
          isOnline: true,
        });
      });

      it('invokes failure handler for non-retryable errors', async () => {
        const handler = jest.fn();
        manager.setFailureHandler(handler);

        const mutation = makeMutation({
          id: 'non-retry-1',
          operationName: 'UpdatePantryItem',
          variables: { input: { id: 'item-x' } },
        });
        const error = { message: 'Validation error: invalid' };

        await handleMutationError(mutation, error);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            mutationId: 'non-retry-1',
            operationName: 'UpdatePantryItem',
            entityType: 'PantryItem',
            entityId: 'item-x',
          }),
        );
      });

      it('invokes failure handler on a permanent (non-retryable) error', async () => {
        const handler = jest.fn();
        manager.setFailureHandler(handler);

        const mutation = makeMutation({
          id: 'max-retry-1',
          operationName: 'ToggleShoppingListItemPurchased',
          variables: { id: 'sli-99' },
          retryCount: 0,
          maxRetries: 3,
        });
        // Non-retryable (validation) error → permanent failure → notify.
        const error = { message: 'Validation error: invalid input' };

        await handleMutationError(mutation, error);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            mutationId: 'max-retry-1',
            entityType: 'ShoppingListItem',
            entityId: 'sli-99',
          }),
        );
      });

      it('does NOT invoke failure handler for a transient network error (deferred, not failed)', async () => {
        const handler = jest.fn();
        manager.setFailureHandler(handler);

        const mutation = makeMutation({
          id: 'net-defer-1',
          retryCount: 3,
          maxRetries: 3,
        });

        await handleMutationError(mutation, { message: 'Network error' });

        expect(handler).not.toHaveBeenCalled();
        expect(queueStore.markMutationFailed).not.toHaveBeenCalled();
      });
    });

    // --- Integration: handleAuthError invokes failure handler ---
    describe('handleAuthError invokes failure handler on token refresh failure', () => {
      let handleAuthError: (
        mutation: QueuedMutation,
        error: QueueError,
      ) => Promise<ProcessingResult>;

      beforeEach(() => {
        handleAuthError = manager['handleAuthError'].bind(manager);
        // Token refresh will fail (no accessToken)
        mockedGetState.mockReturnValue({
          user: { id: 'user-1' },
          accessToken: null,
          isOnline: true,
        });
      });

      it('invokes failure handler when token refresh fails', async () => {
        const handler = jest.fn();
        manager.setFailureHandler(handler);

        jest.useRealTimers();
        const mutation = makeMutation({
          id: 'auth-fail-h',
          operationName: 'FavoriteRecipe',
          variables: { input: { recipeId: 'r-10' } },
        });
        const error: QueueError = {
          type: 'auth',
          message: 'Unauthorized',
          timestamp: Date.now(),
          retryable: true,
        };
        await handleAuthError(mutation, error);
        jest.useFakeTimers();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            mutationId: 'auth-fail-h',
            operationName: 'FavoriteRecipe',
            entityType: 'SavedRecipe',
            entityId: 'r-10',
          }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // mergeMoveItemMutations - ReorderShoppingListItems legacy
  // -------------------------------------------------------------------------
  describe('mergeMoveItemMutations - legacy operations', () => {
    let mergeMoveItemMutations: (mutations: QueuedMutation[]) => {
      merged: QueuedMutation[];
      removed: string[];
    };

    beforeEach(() => {
      mergeMoveItemMutations = manager['mergeMoveItemMutations'].bind(manager);
    });

    it('keeps legacy ReorderShoppingListItems mutations as-is', () => {
      const reorder = makeMutation({
        id: 'reorder-1',
        operationName: 'ReorderShoppingListItems',
        variables: { input: { shoppingListId: 'list-1' } },
      });

      const { merged, removed } = mergeMoveItemMutations([reorder]);
      expect(removed).toEqual([]);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('reorder-1');
    });
  });
});
