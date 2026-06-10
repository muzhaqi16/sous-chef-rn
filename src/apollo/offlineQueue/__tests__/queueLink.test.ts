import { ApolloLink, Observable } from '@apollo/client';
import type { ApolloClient, OperationVariables } from '@apollo/client';
import { OperationTypeNode } from 'graphql';
import type { DocumentNode } from 'graphql';
import { createQueueLink } from '../queueLink';
import { queueStore } from '../queueStore';
import { useStore } from '#store';
import { isNetworkError } from '#/utils/isNetworkError';
import { gql } from '@apollo/client';

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
  queueManager: { requestDrain: jest.fn() },
}));

// Mock generateId
jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(() => 'test-uuid'),
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

const MOCK_LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
    }
  }
`;

/** Build a minimal Apollo Operation */
function makeOperation(options: {
  query: DocumentNode;
  operationName?: string;
  variables?: OperationVariables;
  context?: ApolloLink.OperationContext;
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
    client: {} as ApolloClient,
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
      observable!.subscribe({
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
      observable!.subscribe({
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
      const forward = failingForward(new Error('Network request failed'));

      let sawQueued = false;
      link.request(operation, forward)!.subscribe({
        next(result) {
          sawQueued = result.extensions?.queued === true;
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

    it('persists only the allowlisted context keys (localFirst, operationId)', done => {
      mockedGetState.mockReturnValue({
        isOnline: true,
        user: { id: 'user-1' },
      });
      // The live Apollo operation context carries client internals that must
      // not be persisted: functions vanish under JSON serialization and a
      // circular value would make the MMKV write throw, losing the enqueue.
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
      const forward = failingForward(new Error('Network request failed'));

      link.request(operation, forward)!.subscribe({
        complete() {
          const queued = (queueStore.addMutation as jest.Mock).mock.calls[0][0];
          expect(queued.context).toEqual({
            localFirst: true,
            operationId: 'op-1',
          });
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
      const forward = failingForward(new Error('Network request failed'));

      link.request(operation, forward)!.subscribe({
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
        query: MOCK_MUTATION,
        operationName: 'UpdateItem',
        variables: { input: { id: 'item-1' } },
        context: { localFirst: true },
      });
      const forward = failingForward(
        new Error('Validation failed: name required'),
      );

      link.request(operation, forward)!.subscribe({
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
        query: MOCK_MUTATION,
        operationName: 'UpdateItem',
        variables: { input: { id: 'item-1' } },
        context: { localFirst: true },
      });
      const forward = makeForward({ updateItem: { id: 'item-1' } });

      link.request(operation, forward)!.subscribe({
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
    it('queues a localFirst mutation when offline and returns optimistic response', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const optimistic = { addItem: { id: 'temp-1', name: 'Apple' } };
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
        context: { localFirst: true, optimisticResponse: optimistic },
      });
      const forward = makeForward();

      const observable = link.request(operation, forward);
      observable!.subscribe({
        next(result) {
          expect(result.data).toEqual(optimistic);
          expect(result.extensions).toEqual({ queued: true });
        },
        complete() {
          // Should NOT have forwarded to the network
          expect(forward).not.toHaveBeenCalled();
          // Should have queued the mutation
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
          const queued = (queueStore.addMutation as jest.Mock).mock.calls[0][0];
          expect(queued.operationName).toBe('AddItem');
          expect(queued.userId).toBe('user-1');
          expect(queued.optimisticResponse).toEqual(optimistic);
          done();
        },
      });
    });

    it('queues a localFirst mutation without optimistic response, returns null-field data', done => {
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
      observable!.subscribe({
        next(result) {
          // Each top-level mutation field is emitted as null so Apollo's result
          // write doesn't warn "Missing field"; the classifier reads a null
          // payload field as queued.
          expect(result.data).toEqual({ addItem: null });
          expect(result.extensions).toEqual({ queued: true });
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
        query: MOCK_MUTATION,
        operationName: 'UpdatePantryItem',
        variables: { input: { id: 'item-1', quantity: 2 } },
        // no localFirst — allowlisted via SYNC_REGISTRY
      });
      const forward = makeForward();

      link.request(operation, forward)!.subscribe({
        next(result) {
          expect(result.extensions).toEqual({ queued: true });
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
        query: MOCK_MUTATION,
        operationName: 'CreateRecipeReview',
        variables: { input: { rating: 5 } },
        // no localFirst, no Sync* mapping → online-only
      });
      const forward = makeForward();

      link.request(operation, forward)!.subscribe({
        next() {
          done(new Error('should not emit a result'));
        },
        error(err) {
          // The hook's error path shows an honest failure; nothing replays later.
          expect(isNetworkError(err)).toBe(true);
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
      observable!.subscribe({
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

      link.request(operation, forward)!.subscribe({
        next(result) {
          expect(result.extensions).toEqual({ queued: true });
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

      link.request(operation, forward)!.subscribe({
        complete() {
          expect(forward).toHaveBeenCalledTimes(1);
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('never-queue operations', () => {
    const neverQueueOps = [
      'RefreshToken',
      'Login',
      'Register',
      'SignUp',
      'Logout',
      'VerifyEmail',
    ];

    neverQueueOps.forEach(opName => {
      it(`forwards ${opName} even when offline`, done => {
        mockedGetState.mockReturnValue({
          isOnline: false,
          user: { id: 'user-1' },
        });
        const operation = makeOperation({
          query: MOCK_LOGIN_MUTATION,
          operationName: opName,
        });
        const forward = makeForward({ [opName.toLowerCase()]: { ok: true } });

        const observable = link.request(operation, forward);
        observable!.subscribe({
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
      observable!.subscribe({
        complete() {
          expect(forward).toHaveBeenCalledTimes(1);
          expect(queueStore.addMutation).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
