import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
  type ObservableQuery,
} from '@apollo/client';
import { AppState, type AppStateStatus } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { Telemetry } from '#/services/telemetry';
import type { StoreApi } from 'zustand';
import { resetSessionEndingGate, whileSessionEnds } from '#store/sessionEnding';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { APOLLO_DEFAULT_OPTIONS } from '../defaultOptions';
import {
  connectResyncSources,
  createRefetchEventManager,
} from '../refetchEvents';

const mockReconnectListeners = new Set<() => void>();

jest.mock('#/apollo/links/wsLink', () => ({
  onWebSocketReconnected: (listener: () => void) => {
    mockReconnectListeners.add(listener);
    return () => mockReconnectListeners.delete(listener);
  },
}));
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { whenIdle: jest.fn(async () => {}) },
}));
interface MockSessionState {
  user: { id: string } | null;
  isLoggingOut: boolean;
  isOnline: boolean;
  apiReachable: boolean | null;
}

jest.mock('#store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  return {
    useStore: create<MockSessionState>()(() => ({
      user: { id: 'user-1' },
      isLoggingOut: false,
      isOnline: true,
      apiReachable: true,
    })),
  };
});
const { useStore } = jest.requireMock<{
  useStore: StoreApi<MockSessionState>;
}>('#store');
jest.mock('#/apollo/logoutCleanup', () => {
  const { isSessionEnding } = jest.requireActual<
    typeof import('#store/sessionEnding')
  >('#store/sessionEnding');
  const { useStore: store } = jest.requireMock<{
    useStore: StoreApi<MockSessionState>;
  }>('#store');
  return {
    LogoutCleanup: {
      isInLogoutProcess: () =>
        isSessionEnding() || store.getState().isLoggingOut,
    },
  };
});

const ListQuery = gql`
  query ListForResync {
    list
  }
`;
const SearchQuery = gql`
  query SearchForResync {
    search
  }
`;

const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(settle => {
    resolve = settle;
  });
  return { promise, resolve };
};

const appStateListeners = () =>
  (AppState.addEventListener as jest.Mock).mock.calls
    .filter(([event]) => event === 'change')
    .map(([, listener]) => listener as (next: AppStateStatus) => void);

const emitAppState = (next: AppStateStatus) =>
  appStateListeners().forEach(listener => listener(next));

const triggers = {
  appForeground: () => {
    emitAppState('background');
    emitAppState('active');
  },
  apiReachable: () => {
    useStore.setState({ apiReachable: false });
    useStore.setState({ apiReachable: true });
  },
  wsReconnected: () => mockReconnectListeners.forEach(listener => listener()),
};

let requests: string[];
let client: ApolloClient;
const watchers: Array<{ unsubscribe: () => void }> = [];

const watch = (
  query: typeof ListQuery,
  options: { refetchOn?: false } = {},
) => {
  const observable: ObservableQuery = client.watchQuery({ query, ...options });
  watchers.push(observable.subscribe(() => {}));
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockReconnectListeners.clear();
  resetSessionEndingGate();
  useStore.setState({
    user: { id: 'user-1' },
    isLoggingOut: false,
    apiReachable: true,
  });
  requests = [];
  client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new ApolloLink(
      operation =>
        new Observable(observer => {
          requests.push(operation.operationName ?? '');
          observer.next({ data: { list: 'value', search: 'value' } });
          observer.complete();
        }),
    ),
    refetchEventManager: createRefetchEventManager(),
  });
  connectResyncSources(client);
  watch(ListQuery);
  watch(SearchQuery, { refetchOn: false });
  await flush();
  requests = [];
});

afterEach(() => {
  watchers.splice(0).forEach(watcher => watcher.unsubscribe());
  client.stop();
});

describe('resync', () => {
  it.each(Object.keys(triggers) as Array<keyof typeof triggers>)(
    '%s refetches each active query once',
    async trigger => {
      triggers[trigger]();
      await flush();

      expect(requests).toEqual(['ListForResync']);
      await waitFor(() =>
        expect(Telemetry.increment).toHaveBeenCalledWith(
          'resync_queries_total',
          1,
          { source: trigger },
        ),
      );
    },
  );

  it('refetches once for triggers that arrive while a resync is pending', async () => {
    const idle = deferred();
    jest.mocked(queueManager.whenIdle).mockReturnValueOnce(idle.promise);

    triggers.appForeground();
    triggers.apiReachable();
    triggers.wsReconnected();
    idle.resolve();
    await flush();

    expect(requests).toEqual(['ListForResync']);
    await waitFor(() =>
      expect(Telemetry.increment).toHaveBeenCalledWith(
        'resync_queries_total',
        1,
        { source: 'apiReachable+appForeground+wsReconnected' },
      ),
    );
  });

  it('waits for queued writes to replay before refetching', async () => {
    const idle = deferred();
    jest.mocked(queueManager.whenIdle).mockReturnValueOnce(idle.promise);

    triggers.appForeground();
    await flush();
    expect(requests).toEqual([]);

    idle.resolve();
    await flush();
    expect(requests).toEqual(['ListForResync']);
  });

  it('does not refetch a query that declined resync', async () => {
    triggers.wsReconnected();
    await flush();

    expect(requests).not.toContain('SearchForResync');
  });

  it('does not refetch while a session ends', async () => {
    const idle = deferred();
    jest.mocked(queueManager.whenIdle).mockReturnValueOnce(idle.promise);
    const release = deferred();
    const ending = whileSessionEnds(() => release.promise);

    triggers.appForeground();
    idle.resolve();
    await flush();
    release.resolve();
    await ending;

    expect(requests).toEqual([]);
  });

  it('does not refetch without a session', async () => {
    useStore.setState({ user: null });

    triggers.apiReachable();
    await flush();

    expect(requests).toEqual([]);
  });

  it('starts a new resync for a trigger that arrives after the queue drained', async () => {
    triggers.appForeground();
    await flush();
    triggers.wsReconnected();
    await flush();

    expect(requests).toEqual(['ListForResync', 'ListForResync']);
  });
});
