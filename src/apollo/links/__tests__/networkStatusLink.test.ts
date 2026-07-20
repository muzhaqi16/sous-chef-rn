import { ApolloLink, Observable, gql } from '@apollo/client';
import type { ApolloClient } from '@apollo/client';
import { OperationTypeNode, type DocumentNode } from 'graphql';
import { createNetworkStatusLink } from '../networkStatusLink';
import { apiReachabilityBreaker } from '../apiReachabilityBreaker';
import { OfflineRejectedError } from '../../offlineQueue/OfflineRejectedError';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { isNetworkError } from '#/utils/isNetworkError';
import { logger } from '#/utils/environment';

jest.mock('../apiReachabilityBreaker', () => ({
  apiReachabilityBreaker: {
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  },
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn((e: { network?: boolean }) => e?.network === true),
}));

// Network-error logging now lives here (above retryLink). Default to
// "reachable" so the surprising-case path that warns stays exercised.
jest.mock('#store', () => ({
  useStore: { getState: jest.fn(() => ({ offlineModeEnabled: false })) },
}));
jest.mock('#store/slices/networkSlice', () => ({
  isApiUnavailable: jest.fn(() => false),
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
  const getState = useStore.getState as jest.Mock;
  const mockedIsApiUnavailable = isApiUnavailable as jest.Mock;
  const warn = logger.warn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getState.mockReturnValue({ offlineModeEnabled: false });
    mockedIsApiUnavailable.mockReturnValue(false);
  });

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

  it('warns once per operation on a network error while the API is reachable', () => {
    run(
      forwardEmitting(o => {
        o.error({ network: true, message: 'Network request failed' });
      }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Network error for GetItems'),
    );
  });

  it('suppresses the network-error warning while offline mode is enabled', () => {
    getState.mockReturnValue({ offlineModeEnabled: true });
    run(
      forwardEmitting(o => {
        o.error({ network: true, message: 'Network request failed' });
      }),
    );
    expect(recordFailure).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('suppresses the network-error warning once the API is known-unavailable', () => {
    mockedIsApiUnavailable.mockReturnValue(true);
    run(
      forwardEmitting(o => {
        o.error({ network: true, message: 'Network request failed' });
      }),
    );
    expect(recordFailure).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores queueLink’s offline fast-fail rejection (never touched the network)', () => {
    // The offline rejection proves nothing about API reachability — counting it
    // would feed the breaker a preemptive decision. The guard short-circuits
    // BEFORE the network-error branch (so isNetworkError is never consulted) and
    // still propagates the error so the hook surfaces its honest offline failure.
    const err = new OfflineRejectedError('AddItem');
    let propagated: unknown;
    link
      .request(
        operation(),
        forwardEmitting(o => o.error(err)),
      )
      ?.subscribe({
        next: () => {},
        error: e => {
          propagated = e;
        },
        complete: () => {},
      });

    expect(recordFailure).not.toHaveBeenCalled();
    expect(recordSuccess).not.toHaveBeenCalled();
    expect(isNetworkError).not.toHaveBeenCalled();
    expect(propagated).toBe(err);
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
