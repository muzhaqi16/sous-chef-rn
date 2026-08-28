import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import { OperationTypeNode, type DocumentNode } from 'graphql';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createOfflineModeLink } from '../offlineModeLink';
import { useStore } from '#store';
import { getI18n } from '#/i18n/config';
import { Telemetry } from '#/services/telemetry';

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
  cache: InMemoryCache = new InMemoryCache(),
): ApolloLink.Operation {
  return {
    query,
    operationName,
    operationType: OperationTypeNode.QUERY,
    variables: {},
    getContext: () => ({}),
    setContext: jest.fn(),
    extensions: {},
    // The offline short-circuit reads the query back out of the cache via
    // operation.client.cache, so the operation needs a real client + cache.
    client: new ApolloClient({
      cache,
      link: ApolloLink.empty(),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    }),
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

/**
 * Screens render `error.message` verbatim, so this string is UI copy. It used
 * to be built as `Offline: no cached data available for ${operationName}`,
 * which put a GraphQL operation name on screen in untranslated English. Assert
 * the localized copy and the absence of the operation name rather than a
 * substring of the old wording, which any rewording would defeat.
 */
function expectUserFacingOfflineMessage(message: string | undefined): void {
  expect(message).toBe(getI18n().t('offline.noCachedData'));
  expect(message).not.toContain('GetItems');
}

describe('createOfflineModeLink', () => {
  const mockedGetState = useStore.getState as jest.Mock;
  const link = createOfflineModeLink();

  beforeEach(() => jest.clearAllMocks());

  /** Subscribe and report whether the observable emitted / completed + the value. */
  function observe(observable: ReturnType<ApolloLink['request']>) {
    let emitted = false;
    let completed = false;
    let value: ApolloLink.Result | undefined;
    observable?.subscribe({
      next: result => {
        emitted = true;
        value = result;
      },
      complete: () => {
        completed = true;
      },
    });
    return { emitted, completed, value };
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

  it('blocks cache-miss queries when offline mode is enabled (error result, no `{}` cache write)', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: true,
      isOnline: true,
    });
    const forward = makeForward();
    const { emitted, completed, value } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(emitted).toBe(true);
    expect(completed).toBe(true);
    // The error is load-bearing: an error-free `{ data: null }` makes Apollo 4
    // write `{}` against the selection set ("Missing field X" warning spam).
    expect(value?.data).toBeNull();
    expectUserFacingOfflineMessage(value?.errors?.[0]?.message);
  });

  it('blocks cache-miss queries when the device is offline (error result)', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: false,
    });
    const forward = makeForward();
    const { emitted, completed, value } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(emitted).toBe(true);
    expect(completed).toBe(true);
    expect(value?.data).toBeNull();
    expectUserFacingOfflineMessage(value?.errors?.[0]?.message);
  });

  it('forwards cache-miss queries when only the circuit breaker is open (organic probe)', () => {
    // Device online + offline mode off + apiReachable false: blocking would
    // render an empty screen anyway, so the query fires as a probe — a
    // success closes a spuriously-open circuit via networkStatusLink.
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: true,
      apiReachable: false,
    });
    const forward = makeForward();
    link.request(makeOperation(MOCK_QUERY, 'GetItems'), forward);
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it('serves cached data (no forward) when the circuit breaker is open and the cache has it', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: true,
      apiReachable: false,
    });
    const cache = new InMemoryCache();
    const cachedData = { items: [{ __typename: 'Item', id: '1' }] };
    cache.writeQuery({ query: MOCK_QUERY, data: cachedData });

    const forward = makeForward();
    const { value } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems', cache), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(value?.data).toEqual(cachedData);
  });

  it('serves cached data for blocked queries (idempotent re-emit, no clobber)', () => {
    mockedGetState.mockReturnValue({
      offlineModeEnabled: false,
      isOnline: false,
    });
    const cache = new InMemoryCache();
    const cachedData = { items: [{ __typename: 'Item', id: '1' }] };
    cache.writeQuery({ query: MOCK_QUERY, data: cachedData });

    const forward = makeForward();
    const { emitted, completed, value } = observe(
      link.request(makeOperation(MOCK_QUERY, 'GetItems', cache), forward),
    );
    expect(forward).not.toHaveBeenCalled();
    expect(emitted).toBe(true);
    expect(completed).toBe(true);
    expect(value?.data).toEqual(cachedData);
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

  // Each branch of this link is a distinct answer to "did offline work?", and
  // until these counters existed none of them were visible in release —
  // `logger` is console-only. The mapping is asserted per branch because a
  // counter on the wrong branch is worse than none: it would report the
  // offline promise holding at exactly the moment it broke.
  describe('telemetry', () => {
    it('counts a cache hit as served', () => {
      mockedGetState.mockReturnValue({
        offlineModeEnabled: true,
        isOnline: true,
      });
      const cache = new InMemoryCache();
      cache.writeQuery({ query: MOCK_QUERY, data: { items: [] } });
      observe(
        link.request(
          makeOperation(MOCK_QUERY, 'GetItems', cache),
          makeForward(),
        ),
      );
      expect(Telemetry.increment).toHaveBeenCalledWith(
        'offline_reads_served_total',
        1,
        { operation: 'GetItems' },
      );
    });

    it('counts a blocked cache miss — the one the user feels', () => {
      mockedGetState.mockReturnValue({
        offlineModeEnabled: true,
        isOnline: true,
      });
      observe(
        link.request(makeOperation(MOCK_QUERY, 'GetItems'), makeForward()),
      );
      expect(Telemetry.increment).toHaveBeenCalledWith(
        'offline_reads_blocked_total',
        1,
        { operation: 'GetItems' },
      );
      expect(Telemetry.increment).not.toHaveBeenCalledWith(
        'offline_reads_served_total',
        expect.anything(),
        expect.anything(),
      );
    });
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
