import { InMemoryCache, Observable } from '@apollo/client';
import type {
  ApolloClient,
  OperationVariables,
  ApolloLink,
} from '@apollo/client';
import { OperationTypeNode } from 'graphql';
import type { DocumentNode } from 'graphql';
import { createQueueLink } from '../queueLink';
import { queueStore } from '../queueStore';
import {
  isOfflineRejectedError,
  OfflineRejectedError,
} from '../OfflineRejectedError';
import { useStore } from '#store';
import { isNetworkError } from '#/utils/isNetworkError';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { gql } from '@apollo/client';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  LoginDocument,
  RefreshTokenDocument,
  RegisterDocument,
  VerifyEmailDocument,
} from '#operations/auth/auth.generated';
import { UpdateItemDocument } from '#features/catalog/hooks/useSuggestItemEdit.generated';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { ToggleShoppingListItemPurchasedDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { CreateRecipeReviewDocument } from '#features/recipes/graphql/recipeReview.generated';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';

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

// Mock queueStore so we can spy on addMutation
jest.mock('../queueStore', () => ({
  queueStore: {
    addMutation: jest.fn(),
  },
}));

// Mock queueManager (queueLink calls requestDrain on a successful local-first
// mutation — keep it a no-op spy so no real timer/processing is scheduled).
jest.mock('../queueManager', () => ({
  queueManager: {
    requestDrain: jest.fn(),
    withdrawUnqueueableWrite: jest.fn(),
  },
}));

// Mock generateId
jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(() => 'test-uuid'),
}));

jest.mock('#/apollo/offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: { flushPending: jest.fn() },
}));

// Mock the logger
const MOCK_MUTATION = gql`
  mutation AddItem($input: AddItemInput!) {
    addItem(input: $input) {
      id
      name
    }
  }
`;

const MOCK_QUERY = gql`
  query GetItems {
    items {
      id
      name
    }
  }
`;

/** Build a minimal Apollo Operation */
function makeOperation(options: {
  query: DocumentNode;
  operationName?: string;
  variables?: OperationVariables;
  context?: ApolloLink.OperationContext;
  cache?: InMemoryCache;
}): ApolloLink.Operation {
  const contextMap: ApolloLink.OperationContext = options.context || {};
  return {
    query: options.query,
    operationName: options.operationName ?? '',
    operationType: OperationTypeNode.MUTATION,
    variables: options.variables ?? {},
    getContext: () => contextMap,
    setContext: jest.fn(),
    extensions: {},
    // The link reads only the cache, where the queued write's row is.
    client: {
      cache: options.cache ?? new InMemoryCache(),
    } as Partial<ApolloClient> as ApolloClient,
  };
}

/** Forward function that returns a simple observable */
function makeForward(
  data: ApolloLink.Result['data'] = { testData: true },
): ApolloLink.ForwardFunction {
  return jest.fn(
    () =>
      new Observable<ApolloLink.Result>(observer => {
        observer.next({ data });
        observer.complete();
      }),
  );
}

describe('createQueueLink', () => {
  const mockedGetState = useStore.getState as jest.Mock;
  let link: ReturnType<typeof createQueueLink>;

  beforeEach(() => {
    jest.clearAllMocks();
    link = createQueueLink();
  });

  // -------------------------------------------------------------------------
  // isMutation helper (tested indirectly through link behavior)
  // -------------------------------------------------------------------------
  describe('query pass-through', () => {
    it('forwards queries directly regardless of online status', done => {
      mockedGetState.mockReturnValue({ isOnline: false });
      const operation = makeOperation({
        query: MOCK_QUERY,
        operationName: 'GetItems',
      });
      const forward = makeForward();

      const observable = link.request(operation, forward);
      observable.subscribe({
        next(result) {
          expect(result.data).toEqual({ testData: true });
        },
        complete() {
          expect(forward).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Online pass-through
  // -------------------------------------------------------------------------
  describe('online pass-through', () => {
    it('forwards mutations normally when online', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
      });
      const forward = makeForward({ addItem: { id: '1', name: 'Apple' } });

      const observable = link.request(operation, forward);
      observable.subscribe({
        next(result) {
          expect(result.data).toEqual({ addItem: { id: '1', name: 'Apple' } });
        },
        complete() {
          expect(forward).toHaveBeenCalledTimes(1);
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Online network-error → queue (opt-in via context.localFirst)
  // -------------------------------------------------------------------------
  describe('online network-error interception (localFirst)', () => {
    const failingForward = (error: unknown): ApolloLink.ForwardFunction =>
      jest.fn(
        () =>
          new Observable<ApolloLink.Result>(observer => {
            observer.error(error);
          }),
      );

    it('queues a localFirst mutation when online and the request fails with a network error', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'DeleteItem',
        variables: { input: { id: 'item-1' } },
        context: { localFirst: true },
      });
      const forward = failingForward(
        new NetworkRequestError('Network request failed'),
      );

      let sawQueued = false;
      link.request(operation, forward).subscribe({
        next(result) {
          // The 'network-error' reason is load-bearing: networkStatusLink only
          // counts THIS flavor of queued result as a breaker failure.
          sawQueued =
            result.extensions?.queued === true &&
            result.extensions?.queuedReason === 'network-error';
        },
        error(err) {
          done(new Error(`should not error — should queue instead: ${err}`));
        },
        complete() {
          expect(sawQueued).toBe(true);
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          const queued = (queueStore.addMutation as jest.Mock).mock.calls[0][0];
          expect(queued.operationName).toBe('DeleteItem');
          done();
        },
      });
    });

    it('persists only the allowlisted context key (localFirst) and drops everything else', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      // The live Apollo operation context carries client internals that must
      // not be persisted: functions vanish under JSON serialization and a
      // circular value would make the MMKV write throw, losing the enqueue.
      // Idempotency now rides on input.idempotencyKey (in the variables), not on
      // the context, so only localFirst survives here.
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AdjustItem',
        variables: { input: { itemId: 'item-1' } },
        context: {
          localFirst: true,
          operationId: 'op-1',
          cache: circular,
          fetchOptions: () => undefined,
        },
      });
      const forward = failingForward(
        new NetworkRequestError('Network request failed'),
      );

      link.request(operation, forward).subscribe({
        complete() {
          const queued = (queueStore.addMutation as jest.Mock).mock.calls[0][0];
          expect(queued.context).toEqual({ localFirst: true });
          done();
        },
      });
    });

    it('propagates the error (current behavior) when localFirst is NOT set', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'DeleteItem',
        variables: { input: { id: 'item-1' } },
        // no localFirst
      });
      const forward = failingForward(
        new NetworkRequestError('Network request failed'),
      );

      link.request(operation, forward).subscribe({
        error(err) {
          expect((err as Error).message).toBe('Network request failed');
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('propagates a non-network (validation) error even with localFirst — does NOT queue', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: UpdateItemDocument,
        operationName: operationNameOf(UpdateItemDocument),
        variables: { input: { id: 'item-1' } },
        context: { localFirst: true },
      });
      const forward = failingForward(
        new Error('Validation failed: name required'),
      );

      link.request(operation, forward).subscribe({
        error(err) {
          expect((err as Error).message).toContain('Validation failed');
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('passes a successful localFirst mutation through without queuing', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: UpdateItemDocument,
        operationName: operationNameOf(UpdateItemDocument),
        variables: { input: { id: 'item-1' } },
        context: { localFirst: true },
      });
      const forward = makeForward({ updateItem: { id: 'item-1' } });

      link.request(operation, forward).subscribe({
        next(result) {
          expect(result.data).toEqual({ updateItem: { id: 'item-1' } });
        },
        complete() {
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Offline interception
  // -------------------------------------------------------------------------
  describe('offline interception', () => {
    // The queue is durable at enqueue, so the cache row it replays against must
    // be too: a kill before a deferred save relaunched with no row.
    it('writes the owed cache save in the same step that queues the write', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: operationNameOf(MOCK_MUTATION),
        context: { localFirst: true },
      });

      link.request(operation, makeForward()).subscribe({
        complete() {
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          expect(apolloCachePersistence.flushPending).toHaveBeenCalledTimes(1);
          expect(
            jest.mocked(apolloCachePersistence.flushPending).mock
              .invocationCallOrder[0],
          ).toBeGreaterThan(
            jest.mocked(queueStore.addMutation).mock.invocationCallOrder[0]!,
          );
          done();
        },
      });
    });

    // The replay needs the row's list, which the toggle input does not carry;
    // read now, while the hook's own write keeps the row cached.
    it('records the cached values the replay reads when it queues', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const cache = new InMemoryCache();
      cache.writeFragment({
        id: cache.identify({ __typename: 'ShoppingListItem', id: 'row-1' }),
        fragment: gql`
          fragment QueuedRow on ShoppingListItem {
            id
            itemName
            item {
              id
            }
            shoppingList {
              id
            }
          }
        `,
        data: {
          __typename: 'ShoppingListItem',
          id: 'row-1',
          itemName: 'Milk',
          item: { __typename: 'Item', id: 'item-1' },
          shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
        },
      });
      const operation = makeOperation({
        query: ToggleShoppingListItemPurchasedDocument,
        operationName: operationNameOf(ToggleShoppingListItemPurchasedDocument),
        variables: { input: { id: 'row-1', purchased: true } },
        context: { localFirst: true },
        cache,
      });

      link.request(operation, makeForward()).subscribe({
        complete() {
          expect(
            jest.mocked(queueStore.addMutation).mock.calls[0]?.[0].replayInputs,
          ).toEqual({ shoppingListId: 'list-1', refItemId: 'item-1' });
          done();
        },
      });
    });

    it('queues a localFirst mutation when offline without hitting the network', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
        context: { localFirst: true },
      });
      const forward = makeForward();

      const observable = link.request(operation, forward);
      observable.subscribe({
        next(result) {
          // The hook's own pre-fired cache write provides the UI change; the
          // queued result carries each top-level field as null plus the
          // `queued` marker.
          expect(result.data).toEqual({ addItem: null });
          expect(result.extensions).toEqual({
            queued: true,
            queuedReason: 'offline',
          });
        },
        complete() {
          // Should NOT have forwarded to the network
          expect(forward).not.toHaveBeenCalled();
          // Should have queued the mutation
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          const queued = (queueStore.addMutation as jest.Mock).mock.calls[0][0];
          expect(queued.operationName).toBe('AddItem');
          expect(queued.userId).toBe('user-1');
          done();
        },
      });
    });

    it('queues a localFirst mutation, returns null-field data', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        context: { localFirst: true },
      });
      const forward = makeForward();

      const observable = link.request(operation, forward);
      observable.subscribe({
        next(result) {
          // Each top-level mutation field is emitted as null so Apollo's result
          // write doesn't warn "Missing field"; the classifier reads a null
          // payload field as queued.
          expect(result.data).toEqual({ addItem: null });
          expect(result.extensions).toEqual({
            queued: true,
            queuedReason: 'offline',
          });
        },
        complete() {
          expect(forward).not.toHaveBeenCalled();
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('queues a Sync*-mapped operation even WITHOUT localFirst (idempotent replay)', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: UpdatePantryItemDocument,
        operationName: operationNameOf(UpdatePantryItemDocument),
        variables: { input: { id: 'item-1', quantity: 2 } },
        // no localFirst — allowlisted via SYNC_REGISTRY
      });
      const forward = makeForward();

      link.request(operation, forward).subscribe({
        next(result) {
          expect(result.extensions).toEqual({
            queued: true,
            queuedReason: 'offline',
          });
        },
        complete() {
          expect(forward).not.toHaveBeenCalled();
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('rejects a non-allowlisted mutation with a network-shaped error instead of ghost-queueing it', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: CreateRecipeReviewDocument,
        operationName: operationNameOf(CreateRecipeReviewDocument),
        variables: { input: { rating: 5 } },
        // no localFirst, no Sync* mapping → online-only
      });
      const forward = makeForward();

      link.request(operation, forward).subscribe({
        next() {
          done(new Error('should not emit a result'));
        },
        error(err) {
          // The hook's error path shows an honest failure; nothing replays later.
          // It is the named OfflineRejectedError, never a network failure: the
          // breaker and telemetry skip it, since it never touched the wire.
          expect(err).toBeInstanceOf(OfflineRejectedError);
          expect(isOfflineRejectedError(err)).toBe(true);
          expect(isNetworkError(err)).toBe(false);
          expect((err as Error).message).toContain('CreateRecipeReview');
          expect(forward).not.toHaveBeenCalled();
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('errors when offline with no authenticated user', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: null,
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        context: { localFirst: true },
      });
      const forward = makeForward();

      const observable = link.request(operation, forward);
      observable.subscribe({
        error(err) {
          expect(err.message).toBe(
            'Cannot queue mutation: No authenticated user',
          );
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Never-queue operations
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // API unreachable while online (reachability circuit breaker open)
  // -------------------------------------------------------------------------
  describe('api-unreachable interception (apiReachable === false)', () => {
    it('queues a localFirst mutation immediately, without firing a doomed request', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        apiReachable: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
        context: { localFirst: true },
      });
      const forward = makeForward();

      link.request(operation, forward).subscribe({
        next(result) {
          expect(result.extensions).toEqual({
            queued: true,
            queuedReason: 'api-unreachable',
          });
        },
        complete() {
          expect(forward).not.toHaveBeenCalled();
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('does NOT queue a non-localFirst mutation — it fires (and may fail) as before', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        apiReachable: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
        // no localFirst
      });
      const forward = makeForward();

      link.request(operation, forward).subscribe({
        complete() {
          expect(forward).toHaveBeenCalledTimes(1);
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('queues a Sync*-mapped operation WITHOUT localFirst (matches the offline allowlist)', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        apiReachable: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: UpdatePantryItemDocument,
        operationName: operationNameOf(UpdatePantryItemDocument),
        variables: { input: { id: 'item-1', quantity: 2 } },
        // no localFirst — allowlisted via SYNC_REGISTRY, same as the offline path
      });
      const forward = makeForward();

      link.request(operation, forward).subscribe({
        next(result) {
          expect(result.extensions).toEqual({
            queued: true,
            queuedReason: 'api-unreachable',
          });
        },
        complete() {
          expect(forward).not.toHaveBeenCalled();
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });
  });

  describe('never-queue operations', () => {
    const neverQueueDocuments = [
      RefreshTokenDocument,
      LoginDocument,
      RegisterDocument,
      VerifyEmailDocument,
    ];

    neverQueueDocuments.forEach(document => {
      const opName = operationNameOf(document);
      it(`forwards ${opName} even when offline`, done => {
        mockedGetState.mockReturnValue({
          isOnline: false,
          user: { id: 'user-1' },
        });
        const operation = makeOperation({
          query: document,
          operationName: opName,
        });
        const forward = makeForward({ [opName.toLowerCase()]: { ok: true } });

        const observable = link.request(operation, forward);
        observable.subscribe({
          complete() {
            expect(forward).toHaveBeenCalledTimes(1);
            expect(queueStore.addMutation).not.toHaveBeenCalled();
            done();
          },
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // skipQueueLink context
  // -------------------------------------------------------------------------
  describe('skipQueueLink context', () => {
    it('forwards mutation directly when skipQueueLink is set', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        context: { skipQueueLink: true },
      });
      const forward = makeForward();

      const observable = link.request(operation, forward);
      observable.subscribe({
        complete() {
          expect(forward).toHaveBeenCalledTimes(1);
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('capacity rejection withdraws the write that already landed', () => {
    // The house pattern writes the cache permanently and THEN fires. A refused
    // enqueue therefore leaves the change on screen, in the persisted cache, with
    // no queue entry and no drain that will ever carry it — the one way this
    // system could diverge from the server silently and permanently.
    const { QueueCapacityError } = require('../types');
    const { queueManager } = require('../queueManager');

    beforeEach(() => {
      jest.clearAllMocks();
      (queueStore.addMutation as jest.Mock).mockImplementation(() => {
        throw new QueueCapacityError();
      });
    });

    afterEach(() => {
      (queueStore.addMutation as jest.Mock).mockReset();
    });

    it('withdraws the local change and surfaces the error', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
        context: { localFirst: true },
      });

      link.request(operation, makeForward()).subscribe({
        next() {
          done(new Error('a refused enqueue must not report success'));
        },
        error(error) {
          expect(error).toBeInstanceOf(QueueCapacityError);
          expect(queueManager.withdrawUnqueueableWrite).toHaveBeenCalledWith(
            expect.objectContaining({ operationName: 'AddItem' }),
            expect.objectContaining({ retryable: false }),
          );
          // Nothing was queued, so no save is owed to a queued write.
          expect(apolloCachePersistence.flushPending).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
