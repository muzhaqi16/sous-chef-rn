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
      extract: jest.fn(() => ({})),
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

// Mock telemetry — queueManager emits queue-health metrics during drains
jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    gauge: jest.fn(),
    increment: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

// Mock the token refresh used on auth errors (dynamically imported by the
// manager). Default: refresh fails (returns undefined) — individual tests
// override with mockResolvedValue('new-token').
jest.mock('../../links/refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(),
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
  // Strict FIFO replay
  // -------------------------------------------------------------------------
  describe('strict FIFO replay', () => {
    /**
     * Instrument processMutation to record start/end interleaving: strict
     * FIFO alternates start → end per mutation; any concurrency would show a
     * second start before the first end.
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

    it('replays every mutation strictly in insertion order', async () => {
      // Insertion order is causal order: a list created offline must land
      // before the items that reference its client-minted id, and unrelated
      // entities still replay in the order the user acted.
      const createList = makeMutation({
        id: 'mut-create-list',
        operationName: 'CreateShoppingList',
        variables: { input: { id: 'list-1', name: 'Offline list' } },
      });
      const addA = makeMutation({
        id: 'mut-add-a',
        operationName: 'AddItemToShoppingList',
        variables: {
          input: { shoppingListId: 'list-1', items: [{ id: 'item-a' }] },
        },
      });
      const unrelatedPantryAdd = makeMutation({
        id: 'mut-pantry',
        operationName: 'CreatePantryItem',
        variables: { input: { id: 'pantry-item-1' } },
      });
      (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([
        createList,
        addA,
        unrelatedPantryAdd,
      ]);

      const events: string[] = [];
      instrumentProcessing(events);

      await manager.processQueue();

      expect(events).toEqual([
        'start:mut-create-list',
        'end:mut-create-list',
        'start:mut-add-a',
        'end:mut-add-a',
        'start:mut-pantry',
        'end:mut-pantry',
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
        data: { syncPantryItem: { item: {}, converged: false } },
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

    // Under errorPolicy 'all' a server refusal resolves as an error union
    // member instead of throwing — the replay path must classify resolved
    // payloads the same way the foreground path does (classifyCreateResult).
    describe('resolved error payloads on replay', () => {
      it('treats a ConflictError(code: IDEMPOTENT_REPLAY) as converged (success)', async () => {
        const mutation = makeMutation({
          id: 'proc-converged',
          operationName: 'CreateShoppingList',
          variables: { input: { id: 'list-1' } },
        });
        client.mutate.mockResolvedValue({
          data: {
            createShoppingList: {
              __typename: 'ConflictError',
              code: 'IDEMPOTENT_REPLAY',
              message: 'A shopping list with this id already exists',
            },
          },
        });

        jest.useRealTimers();
        const result = await processMutation(mutation);
        jest.useFakeTimers();

        expect(result.success).toBe(true);
        expect(queueStore.markMutationFailed).not.toHaveBeenCalled();
        expect(queueStore.updateMutation).toHaveBeenCalledWith(
          'proc-converged',
          { status: QueueStatus.SUCCESS, processedAt: expect.any(Number) },
        );
      });

      it('routes a ValidationError payload to the permanent-failure pipeline', async () => {
        const failureHandler = jest.fn();
        manager.setFailureHandler(failureHandler);
        const mutation = makeMutation({
          id: 'proc-rejected',
          operationName: 'UpdateShoppingList',
          variables: { input: { id: 'list-1' } },
        });
        client.mutate.mockResolvedValue({
          data: {
            updateShoppingList: {
              __typename: 'ValidationError',
              message: 'name must not be empty',
            },
          },
        });

        jest.useRealTimers();
        const result = await processMutation(mutation);
        jest.useFakeTimers();

        expect(result.success).toBe(false);
        expect(queueStore.markMutationFailed).toHaveBeenCalledWith(
          'proc-rejected',
          expect.objectContaining({
            type: 'unknown',
            retryable: false,
            code: 'ValidationError',
            message: 'name must not be empty',
          }),
        );
        expect(failureHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            mutationId: 'proc-rejected',
            operationName: 'UpdateShoppingList',
            entityId: 'list-1',
          }),
        );
      });

      it('treats a ConflictError on a replayed UPDATE as a rejection, not convergence', async () => {
        const mutation = makeMutation({
          id: 'proc-conflict-update',
          operationName: 'UpdateShoppingList',
          variables: { input: { id: 'list-1' } },
        });
        client.mutate.mockResolvedValue({
          data: {
            updateShoppingList: {
              __typename: 'ConflictError',
              message: 'version conflict',
            },
          },
        });

        jest.useRealTimers();
        const result = await processMutation(mutation);
        jest.useFakeTimers();

        expect(result.success).toBe(false);
        expect(queueStore.markMutationFailed).toHaveBeenCalledWith(
          'proc-conflict-update',
          expect.objectContaining({ code: 'ConflictError', retryable: false }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  // The entity type feeds the failure handler's cache evict. It is derived
  // from the normalized cache (`TypeName:id` keys) at failure time — the
  // hook already wrote the entity to the cache before firing, so the cache
  // itself knows the typename; no per-operation bookkeeping exists.
  describe('extractEntityInfo', () => {
    let extractEntityInfo: (mutation: QueuedMutation) => {
      entityType: string | null;
      entityId: string | null;
    };
    const { client } = require('../../client');

    beforeEach(() => {
      extractEntityInfo = manager['extractEntityInfo'].bind(manager);
    });

    it('derives the typename from the cached entity, regardless of operation name', () => {
      client.cache.extract.mockReturnValue({
        'ShoppingList:list-1': { __typename: 'ShoppingList', id: 'list-1' },
        'ShoppingListItem:item-1': {
          __typename: 'ShoppingListItem',
          id: 'item-1',
        },
      });

      // Container-level op resolves to the container entity
      expect(
        extractEntityInfo(
          makeMutation({
            operationName: 'UpdateShoppingList',
            variables: { input: { id: 'list-1' } },
          }),
        ),
      ).toEqual({ entityType: 'ShoppingList', entityId: 'list-1' });

      // Compound op names need no special-casing — the id finds the entity
      expect(
        extractEntityInfo(
          makeMutation({
            operationName: 'AddItemToShoppingListFromFilteredPantry',
            variables: { input: { id: 'item-1' } },
          }),
        ),
      ).toEqual({ entityType: 'ShoppingListItem', entityId: 'item-1' });
    });

    it('returns null entityType when the entity is not cached (already evicted)', () => {
      client.cache.extract.mockReturnValue({});
      expect(
        extractEntityInfo(
          makeMutation({
            operationName: 'DeletePantryItem',
            variables: { input: { id: 'pi-1' } },
          }),
        ),
      ).toEqual({ entityType: null, entityId: 'pi-1' });
    });

    it('skips the cache lookup when the mutation has no entity id', () => {
      expect(
        extractEntityInfo(
          makeMutation({
            operationName: 'AddItemsToShoppingList',
            variables: {},
          }),
        ),
      ).toEqual({ entityType: null, entityId: null });
      expect(client.cache.extract).not.toHaveBeenCalled();
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

    // Granular deltas (adjust/restock/consume/open/waste/convert-expired) no
    // longer convert to a sync* twin — they replay as the original canonical
    // mutation, made at-most-once by the client-minted `input.idempotencyKey`
    // the server dedups on (returning ConflictError(IDEMPOTENT_REPLAY)).
    it('replays a granular delta as the original canonical mutation (no sync conversion)', () => {
      const mutation = makeMutation({
        operationName: 'AdjustPantryItemQuantity',
        variables: {
          input: {
            id: 'item-1',
            newQuantity: 3,
            reason: 'recount',
            idempotencyKey: 'op-cuid-1',
          },
        },
        context: { localFirst: true },
      });
      const { syncMutation, syncVariables } = convertToSyncMutation(mutation);
      // Falls through to the default: same document + variables, key intact.
      expect(syncMutation).toBe(mutation.mutation);
      expect(syncVariables).toEqual(mutation.variables);
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

    it('converts AddItemToShoppingList (batch-of-1 input) → SyncShoppingListItem ({ clientId, item })', () => {
      // The single-add op now sends the batch AddItemsToShoppingListInput shape;
      // the sync builder flattens items[0] (+ shoppingListId) back to one item.
      const mutation = makeMutation({
        operationName: 'AddItemToShoppingList',
        variables: {
          input: {
            shoppingListId: 'list-1',
            items: [
              {
                id: 'sl-1',
                itemName: 'Bread',
                quantity: 2,
              },
            ],
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
            shoppingListId: 'list-1',
            items: [
              {
                id: 'sl-9',
                itemId: 'cat-1',
                itemName: 'Cereal',
                quantity: 1,
                brand: { brandId: 'b1' },
                netWeight: { netWeight: 500 },
              },
            ],
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
          input: {
            shoppingListId: 'list-1',
            items: [{ id: 'sl-10', itemId: 'cat-2' }],
          },
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
            shoppingListId: 'list-1',
            items: [
              { id: 'sl-11', itemId: 'cat-3', itemName: 'Rice', quantity: 3 },
            ],
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
            converged: false,
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

    it('processes pending mutations and cleans up', async () => {
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
            converged: true,
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

    it('breaks processing when going offline mid-drain', async () => {
      let callCount = 0;
      mockedGetState.mockImplementation(() => {
        callCount++;
        // First call = processQueue check, second = validateToken, third = per-mutation reachability check
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
  // Auth error handling (via handleMutationError)
  // -------------------------------------------------------------------------
  describe('auth error handling', () => {
    let handleMutationError: (
      mutation: QueuedMutation,
      error: unknown,
    ) => Promise<ProcessingResult>;
    const { proactiveTokenRefresh } = require('../../links/refreshToken');
    const authError = {
      message: 'Unauthorized',
      extensions: { code: 'UNAUTHENTICATED' },
    };

    beforeEach(() => {
      handleMutationError = manager['handleMutationError'].bind(manager);
      mockedGetState.mockReturnValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        isOnline: true,
        apiReachable: true,
        setNeedsTokenRefresh: jest.fn(),
      });
    });

    it('refreshes the token and retries through the bounded counter', async () => {
      const { client: mockClient } = require('../../client');
      (proactiveTokenRefresh as jest.Mock).mockResolvedValue('new-token');
      mockClient.mutate.mockResolvedValue({
        data: { syncPantryItem: { item: {}, converged: false } },
      });

      jest.useRealTimers();
      const mutation = makeMutation({ id: 'auth-retry-1', retryCount: 0 });
      const result = await handleMutationError(mutation, authError);
      jest.useFakeTimers();

      expect(proactiveTokenRefresh).toHaveBeenCalledTimes(1);
      expect(queueStore.incrementRetry).toHaveBeenCalledWith('auth-retry-1');
      expect(result.success).toBe(true);
    });

    it('marks AUTH_ERROR without retrying when the refresh fails', async () => {
      const { client: mockClient } = require('../../client');
      (proactiveTokenRefresh as jest.Mock).mockResolvedValue(null);

      jest.useRealTimers();
      const mutation = makeMutation({ id: 'auth-fail-1' });
      const result = await handleMutationError(mutation, authError);
      jest.useFakeTimers();

      expect(result.success).toBe(false);
      expect(mockClient.mutate).not.toHaveBeenCalled();
      expect(queueStore.markMutationFailed).toHaveBeenCalledWith(
        'auth-fail-1',
        expect.objectContaining({ type: 'auth' }),
      );
    });

    it('does not loop on a persistent 401 — retries are bounded by maxRetries', async () => {
      // Regression: the old dedicated auth path re-validated the existing
      // token (without refreshing) and retried unconditionally, looping
      // forever on a revoked session.
      (proactiveTokenRefresh as jest.Mock).mockResolvedValue('new-token');

      jest.useRealTimers();
      const mutation = makeMutation({
        id: 'auth-exhausted-1',
        retryCount: 3,
        maxRetries: 3,
      });
      const result = await handleMutationError(mutation, authError);
      jest.useFakeTimers();

      expect(result.success).toBe(false);
      expect(queueStore.markMutationFailed).toHaveBeenCalledWith(
        'auth-exhausted-1',
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
      // The failure handler derives the entity typename from the normalized
      // cache — seed the entities these tests fail mutations against.
      const { client } = require('../../client');
      client.cache.extract.mockReturnValue({
        'PantryItem:item-1': {},
        'PantryItem:item-x': {},
        'ShoppingListItem:sli-99': {},
        'ShoppingList:list-10': {},
      });
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

    // --- extractEntityInfo: entity id extraction across variable shapes ---
    describe('extractEntityInfo', () => {
      it.each([
        ['input.id', 'UpdatePantryItem', { input: { id: 'pi-1' } }, 'pi-1'],
        ['top-level id', 'DeletePantryItem', { id: 'top-1' }, 'top-1'],
        [
          'input.pantryItemId',
          'AdjustPantryItemQuantity',
          { input: { pantryItemId: 'pid-1' } },
          'pid-1',
        ],
        [
          'input.itemId',
          'MoveShoppingListItem',
          { input: { itemId: 'iid-1' } },
          'iid-1',
        ],
        [
          'input.batchId',
          'OpenPantryItemBatch',
          { input: { batchId: 'b-1' } },
          'b-1',
        ],
        ['clientId', 'CreatePantryItem', { clientId: 'cid-1' }, 'cid-1'],
      ])(
        'extracts the entity id from %s',
        (_label, operationName, variables, expectedId) => {
          const info = extractEntityInfo(
            makeMutation({ operationName, variables }),
          );
          expect(info.entityId).toBe(expectedId);
        },
      );

      it('returns nulls when no recognizable variables exist', () => {
        expect(
          extractEntityInfo(
            makeMutation({
              operationName: 'UpdatePantryItem',
              variables: { foo: 'bar' },
            }),
          ),
        ).toEqual({ entityType: null, entityId: null });
        expect(
          extractEntityInfo(
            makeMutation({ operationName: 'UnknownOp', variables: undefined }),
          ),
        ).toEqual({ entityType: null, entityId: null });
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

    // --- Integration: auth failure invokes failure handler ---
    describe('auth failure invokes failure handler on token refresh failure', () => {
      it('invokes failure handler when token refresh fails', async () => {
        const { proactiveTokenRefresh } = require('../../links/refreshToken');
        (proactiveTokenRefresh as jest.Mock).mockResolvedValue(null);
        const handler = jest.fn();
        manager.setFailureHandler(handler);
        const handleMutationError =
          manager['handleMutationError'].bind(manager);

        jest.useRealTimers();
        const mutation = makeMutation({
          id: 'auth-fail-h',
          operationName: 'UpdateShoppingList',
          variables: { input: { id: 'list-10' } },
        });
        await handleMutationError(mutation, {
          message: 'Unauthorized',
          extensions: { code: 'UNAUTHENTICATED' },
        });
        jest.useFakeTimers();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            mutationId: 'auth-fail-h',
            operationName: 'UpdateShoppingList',
            entityType: 'ShoppingList',
            entityId: 'list-10',
          }),
        );
      });
    });
  });
});
