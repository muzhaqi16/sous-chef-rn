import { Observable } from '@apollo/client';
import { createQueueLink } from '../queueLink';
import { queueStore } from '../queueStore';
import { useStore } from '#store';
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

// Mock generateId
jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(() => 'test-uuid'),
}));

// Mock the logger
jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

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
  query: any;
  operationName?: string;
  variables?: Record<string, any>;
  context?: Record<string, any>;
}) {
  const contextMap: Record<string, any> = options.context || {};
  return {
    query: options.query,
    operationName: options.operationName ?? '',
    variables: options.variables ?? {},
    getContext: () => contextMap,
    setContext: jest.fn(),
    extensions: {},
  };
}

/** Forward function that returns a simple observable */
function makeForward(data: any = { testData: true }) {
  return jest.fn(() =>
    new Observable(observer => {
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
      const operation = makeOperation({ query: MOCK_QUERY, operationName: 'GetItems' });
      const forward = makeForward();

      const observable = link.request(operation as any, forward as any);
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

      const observable = link.request(operation as any, forward as any);
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
  // Offline interception
  // -------------------------------------------------------------------------
  describe('offline interception', () => {
    it('queues mutation when offline and returns optimistic response', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const optimistic = { addItem: { id: 'temp-1', name: 'Apple' } };
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
        variables: { input: { name: 'Apple' } },
        context: { optimisticResponse: optimistic },
      });
      const forward = makeForward();

      const observable = link.request(operation as any, forward as any);
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

    it('queues mutation without optimistic response, returns null data', done => {
      mockedGetState.mockReturnValue({
        isOnline: false,
        user: { id: 'user-1' },
      });
      const operation = makeOperation({
        query: MOCK_MUTATION,
        operationName: 'AddItem',
      });
      const forward = makeForward();

      const observable = link.request(operation as any, forward as any);
      observable!.subscribe({
        next(result) {
          expect(result.data).toBeNull();
          expect(result.extensions).toEqual({ queued: true });
        },
        complete() {
          expect(forward).not.toHaveBeenCalled();
          expect(queueStore.addMutation).toHaveBeenCalledTimes(1);
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
      });
      const forward = makeForward();

      const observable = link.request(operation as any, forward as any);
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

        const observable = link.request(operation as any, forward as any);
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

      const observable = link.request(operation as any, forward as any);
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
