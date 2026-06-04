import { ApolloLink, Observable, gql } from '@apollo/client';
import type { ApolloClient } from '@apollo/client';
import { OperationTypeNode, type DocumentNode } from 'graphql';
import { createOfflineModeLink } from '../offlineModeLink';
import { useStore } from '#store';

jest.mock('#store', () => ({
  useStore: { getState: jest.fn() },
}));

const MOCK_QUERY = gql`
  query GetItems {
    items {
      id
    }
  }
`;

const MOCK_MUTATION = gql`
  mutation AddItem($input: AddItemInput!) {
    addItem(input: $input) {
      id
    }
  }
`;

const GET_USER_SETTINGS = gql`
  query GetUserSettings {
    userSettings {
      id
    }
  }
`;

function makeOperation(
  query: DocumentNode,
  operationName: string,
): ApolloLink.Operation {
  return {
    query,
    operationName,
    operationType: OperationTypeNode.QUERY,
    variables: {},
    getContext: () => ({}),
    setContext: jest.fn(),
    extensions: {},
    client: {} as ApolloClient,
  };
}

function makeForward(): ApolloLink.ForwardFunction {
  return jest.fn(
    () =>
      new Observable<ApolloLink.Result>(observer => {
        observer.next({ data: { ok: true } });
        observer.complete();
      }),
  );
}

describe('createOfflineModeLink', () => {
  const mockedGetState = useStore.getState as jest.Mock;
  const link = createOfflineModeLink();

  beforeEach(() => jest.clearAllMocks());

  /** Subscribe and report whether the observable emitted data / completed. */
  function observe(observable: ReturnType<ApolloLink['request']>) {
    let emitted = false;
    let completed = false;
    observable?.subscribe({
      next: () => {
        emitted = true;
      },
      complete: () => {
        completed = true;
      },
    });
    return { emitted, completed };
  }

  it('forwards queries when online and offline mode disabled', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: true,
    });
    const forward = makeForward();
    link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward);
    expect(forward).toHaveBeenCalled();
  });

  it('blocks queries when offline mode is enabled', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: true,
      isOnline: true,
    });
    const forward = makeForward();
    const { emitted, completed } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(emitted).toBe(false);
    expect(completed).toBe(true);
  });

  it('blocks queries when the device is offline (isOnline === false)', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: false,
    });
    const forward = makeForward();
    const { emitted, completed } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(emitted).toBe(false);
    expect(completed).toBe(true);
  });

  it('blocks queries when the API circuit breaker is open (apiReachable === false)', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: true,
      apiReachable: false,
    });
    const forward = makeForward();
    const { emitted, completed } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(emitted).toBe(false);
    expect(completed).toBe(true);
  });

  it('lets allow-listed queries through even when offline', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: false,
    });
    const forward = makeForward();
    link.request(makeOperation(GET_USER_SETTINGS, 'GetUserSettings'), forward);
    expect(forward).toHaveBeenCalled();
  });

  it('lets mutations through when offline (queueLink handles queuing)', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: false,
    });
    const forward = makeForward();
    link.request(makeOperation(MOCK_MUTATION, 'AddItem'), forward);
    expect(forward).toHaveBeenCalled();
  });
});
