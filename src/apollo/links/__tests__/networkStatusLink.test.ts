import { ApolloLink, Observable, gql } from '@apollo/client';
import type { ApolloClient } from '@apollo/client';
import { OperationTypeNode, type DocumentNode } from 'graphql';
import { createNetworkStatusLink } from '../networkStatusLink';
import { apiReachabilityBreaker } from '../apiReachabilityBreaker';

jest.mock('../apiReachabilityBreaker', () => ({
  apiReachabilityBreaker: {
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  },
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn((e: { network?: boolean }) => e?.network === true),
}));

const QUERY = gql`
  query GetItems {
    items {
      id
    }
  }
`;

const SUBSCRIPTION = gql`
  subscription OnItemChanged {
    itemChanged {
      id
    }
  }
`;

function operation(
  query: DocumentNode = QUERY,
  operationType: OperationTypeNode = OperationTypeNode.QUERY,
): ApolloLink.Operation {
  return {
    query,
    operationName: 'GetItems',
    operationType,
    variables: {},
    getContext: () => ({}),
    setContext: jest.fn(),
    extensions: {},
    client: {} as ApolloClient,
  };
}

/** A forward that emits the given result then completes (or errors). */
function forwardEmitting(
  emit: (observer: {
    next: (r: ApolloLink.Result) => void;
    error: (e: unknown) => void;
    complete: () => void;
  }) => void,
): ApolloLink.ForwardFunction {
  return jest.fn(() => new Observable(observer => emit(observer)));
}

describe('createNetworkStatusLink', () => {
  const link = createNetworkStatusLink();
  const recordSuccess = apiReachabilityBreaker.recordSuccess as jest.Mock;
  const recordFailure = apiReachabilityBreaker.recordFailure as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  function run(forward: ApolloLink.ForwardFunction) {
    link
      .request(operation(), forward)
      ?.subscribe({ next: () => {}, error: () => {}, complete: () => {} });
  }

  it('records a success for a real response', () => {
    run(
      forwardEmitting(o => {
        o.next({ data: { items: [] } });
        o.complete();
      }),
    );
    expect(recordSuccess).toHaveBeenCalledTimes(1);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('records a failure for a mutation queued on a real network error', () => {
    run(
      forwardEmitting(o => {
        o.next({
          data: { addItem: null },
          extensions: { queued: true, queuedReason: 'network-error' },
        });
        o.complete();
      }),
    );
    expect(recordFailure).toHaveBeenCalledTimes(1);
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('ignores a mutation queued preemptively because the breaker is open', () => {
    // Counting these would feed the breaker its own output: the mutation never
    // touched the network, so it is not evidence the API is down.
    run(
      forwardEmitting(o => {
        o.next({
          data: { addItem: null },
          extensions: { queued: true, queuedReason: 'api-unreachable' },
        });
        o.complete();
      }),
    );
    expect(recordFailure).not.toHaveBeenCalled();
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('ignores a mutation queued preemptively while the device is offline', () => {
    run(
      forwardEmitting(o => {
        o.next({
          data: { addItem: null },
          extensions: { queued: true, queuedReason: 'offline' },
        });
        o.complete();
      }),
    );
    expect(recordFailure).not.toHaveBeenCalled();
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('records a failure for a network error', () => {
    run(
      forwardEmitting(o => {
        o.error({ network: true });
      }),
    );
    expect(recordFailure).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-network error (does not touch the breaker)', () => {
    run(
      forwardEmitting(o => {
        o.error({ network: false });
      }),
    );
    expect(recordFailure).not.toHaveBeenCalled();
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('excludes subscriptions entirely — a WS error is not an API failure', () => {
    // One socket drop errors every active subscription at once; counting them
    // tripped the 3-failure threshold and opened the circuit while the HTTP
    // API was healthy.
    const forward = forwardEmitting(o => {
      o.error({ network: true, message: 'WebSocket connection lost' });
    });
    link
      .request(
        operation(SUBSCRIPTION as DocumentNode, OperationTypeNode.SUBSCRIPTION),
        forward,
      )
      ?.subscribe({ next: () => {}, error: () => {}, complete: () => {} });

    expect(forward).toHaveBeenCalledTimes(1);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('excludes subscriptions from success recording too (WS push ≠ HTTP reachability)', () => {
    link
      .request(
        operation(SUBSCRIPTION as DocumentNode, OperationTypeNode.SUBSCRIPTION),
        forwardEmitting(o => {
          o.next({ data: { itemChanged: { id: '1' } } });
          o.complete();
        }),
      )
      ?.subscribe({ next: () => {}, error: () => {}, complete: () => {} });

    expect(recordSuccess).not.toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });
});
