import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
  type ObservableQuery,
} from '@apollo/client';
import { memoryLifecycle } from '#/test-utils/memoryPlatform';
import { act, waitFor } from '@testing-library/react-native';
import { Telemetry } from '#/services/telemetry';
import type { StoreApi } from 'zustand';
import { resetSessionEndingGate, whileSessionEnds } from '#store/sessionEnding';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { APOLLO_DEFAULT_OPTIONS } from '../defaultOptions';
import { changeLanguage, getResolvedLanguage } from '#/i18n';
import { languageLink } from '../links/languageLink';
import {
  connectResyncSources,
  createRefetchEventManager,
} from '../refetchEvents';
import { RESYNC_SCOPE } from '../scopedClient';

const mockReconnectListeners = new Set<() => void>();
let mockChannelOpen = false;

jest.mock('#/apollo/links/wsLink', () => ({
  onWebSocketReconnected: (listener: () => void) => {
    mockReconnectListeners.add(listener);
    return () => mockReconnectListeners.delete(listener);
  },
  isLiveChannelOpen: () => mockChannelOpen,
}));
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { whenIdle: jest.fn(async () => {}) },
}));
interface MockSessionState {
  user: { id: string } | null;
  isOnline: boolean;
  apiReachable: boolean | null;
}

jest.mock('#store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  return {
    useStore: create<MockSessionState>()(() => ({
      user: { id: 'user-1' },
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
  return {
    LogoutCleanup: {
      isInLogoutProcess: () => isSessionEnding(),
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
const DetailQuery = gql`
  query DetailForResync {
    detail
  }
`;

// A scan's lookup carries its card's fragment, as `ItemByLookup` does, and its
// price card's on request; each card also asks for its product by id.
const CardFragments = `
  fragment CardForResync_product on Product {
    id
    origin
  }
  fragment PriceForResync_product on Product {
    id
    price
  }
`;
const LookupQuery = gql`
  query LookupForResync($withPrice: Boolean = false) {
    lookup {
      id
      name
      ...CardForResync_product
      ...PriceForResync_product @include(if: $withPrice)
    }
  }
  ${CardFragments}
`;
const CardQuery = gql`
  query CardForResync($id: ID!) {
    product(id: $id) {
      id
      ...CardForResync_product
    }
  }
  ${CardFragments}
`;
const PriceQuery = gql`
  query PriceForResync($id: ID!) {
    product(id: $id) {
      id
      ...PriceForResync_product
    }
  }
  ${CardFragments}
`;
const pasta = {
  __typename: 'Product',
  id: 'p1',
  name: 'Pasta',
  origin: 'IT',
  price: 3,
};

const navigationListeners = new Set<() => void>();
const navigate = () => navigationListeners.forEach(listener => listener());
const onNavigation = (listener: () => void) => {
  navigationListeners.add(listener);
  return () => {
    navigationListeners.delete(listener);
  };
};

const elapse = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
/** Past the settle window (about 1.5 s) and its cap (about 5 s). */
const pastTheWindow = () => elapse(6_000);

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(settle => {
    resolve = settle;
  });
  return { promise, resolve };
};

const triggers = {
  appForeground: () => {
    memoryLifecycle().moveTo('background');
    memoryLifecycle().moveTo('active');
  },
  apiReachable: () => {
    useStore.setState({ apiReachable: false });
    useStore.setState({ apiReachable: true });
  },
  wsReconnected: () => mockReconnectListeners.forEach(listener => listener()),
  languageChanged: () => {
    void changeLanguage(getResolvedLanguage() === 'es' ? 'en' : 'es');
  },
};

let requests: string[];
/** Operations the server fails with a 503 until cleared. */
let failing: Set<string>;
let heldResponses: Array<() => void> | null;
let client: ApolloClient;

/** Keeps every request in flight until `release`. */
const holdResponses = () => {
  heldResponses = [];
  return {
    release: () => {
      const held = heldResponses ?? [];
      heldResponses = null;
      held.forEach(respond => respond());
    },
  };
};
const watchers: Array<{ unsubscribe: () => void }> = [];

const watch = (
  query: typeof ListQuery,
  options: { refetchOn?: false } = {},
) => {
  const observable: ObservableQuery = client.watchQuery({ query, ...options });
  watchers.push(observable.subscribe(() => {}));
};

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockReconnectListeners.clear();
  mockChannelOpen = false;
  navigationListeners.clear();
  resetSessionEndingGate();
  useStore.setState({
    user: { id: 'user-1' },
    apiReachable: true,
  });
  requests = [];
  failing = new Set();
  heldResponses = null;
  client = new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // As `readByIdFromCache`: a card reads the product the lookup stored.
            product: {
              read: (_, { args, toReference }) =>
                typeof args?.id === 'string'
                  ? toReference({ __typename: 'Product', id: args.id })
                  : undefined,
            },
          },
        },
      },
    }),
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    // The production language link in front: it records what was answered
    // in the language a catch-up asks for.
    link: ApolloLink.from([
      languageLink,
      new ApolloLink(
        operation =>
          new Observable(observer => {
            requests.push(operation.operationName ?? '');
            if (failing.has(operation.operationName ?? '')) {
              observer.error(new Error('503 Service Unavailable'));
              return undefined;
            }
            const respond = () => {
              observer.next({
                data: {
                  list: 'value',
                  search: 'value',
                  detail: 'value',
                  lookup: pasta,
                  product: pasta,
                },
              });
              observer.complete();
            };
            if (heldResponses) heldResponses.push(respond);
            else respond();
          }),
      ),
    ]),
    refetchEventManager: createRefetchEventManager(),
  });
  connectResyncSources(client);
  watch(ListQuery);
  watch(SearchQuery, { refetchOn: false });
  await elapse(0);
  requests = [];
});

afterEach(() => {
  watchers.splice(0).forEach(watcher => watcher.unsubscribe());
  client.stop();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('resync', () => {
  it.each(Object.keys(triggers) as Array<keyof typeof triggers>)(
    '%s refetches each active query once',
    async trigger => {
      triggers[trigger]();
      await pastTheWindow();

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
    await pastTheWindow();
    triggers.apiReachable();
    triggers.wsReconnected();
    idle.resolve();
    await pastTheWindow();

    expect(requests).toEqual(['ListForResync']);
    expect(queueManager.whenIdle).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(Telemetry.increment).toHaveBeenCalledWith(
        'resync_queries_total',
        1,
        { source: 'apiReachable+appForeground+wsReconnected' },
      ),
    );
  });

  // Inside the API's liveness window (two 30 s pings) the server still holds
  // the subscriptions; past it the socket may be dead with no close delivered.
  describe('a return to the app over an open live channel', () => {
    beforeEach(() => {
      mockChannelOpen = true;
    });

    const returnAfter = async (ms: number) => {
      memoryLifecycle().moveTo('background');
      await elapse(ms);
      memoryLifecycle().moveTo('active');
      await pastTheWindow();
    };

    it('asks nothing', async () => {
      triggers.appForeground();
      await pastTheWindow();

      expect(requests).toEqual([]);
    });

    it('asks nothing for a glance at the notification shade', async () => {
      memoryLifecycle().moveTo('inactive');
      memoryLifecycle().moveTo('active');
      await pastTheWindow();

      expect(requests).toEqual([]);
    });

    it('asks nothing after a brief trip to another app', async () => {
      await returnAfter(10_000);

      expect(requests).toEqual([]);
    });

    it('re-asks once the server may have dropped the socket unseen', async () => {
      await returnAfter(90_000);

      expect(requests).toEqual(['ListForResync']);
    });

    it('still resyncs when the socket reconnects after a brief return', async () => {
      await returnAfter(10_000);
      triggers.wsReconnected();
      await pastTheWindow();

      expect(requests).toEqual(['ListForResync']);
    });
  });

  it('re-asks after a brief absence with the channel closed', async () => {
    memoryLifecycle().moveTo('background');
    await elapse(10_000);
    memoryLifecycle().moveTo('active');
    await pastTheWindow();

    expect(requests).toEqual(['ListForResync']);
  });

  it('waits for queued writes to replay before refetching', async () => {
    const idle = deferred();
    jest.mocked(queueManager.whenIdle).mockReturnValueOnce(idle.promise);

    triggers.appForeground();
    await pastTheWindow();
    expect(requests).toEqual([]);

    idle.resolve();
    await pastTheWindow();
    expect(requests).toEqual(['ListForResync']);
  });

  it('does not resync for a switch to the language already in use', async () => {
    void changeLanguage(getResolvedLanguage());
    await pastTheWindow();

    expect(requests).toEqual([]);
  });

  // A home tab stays mounted while hidden, so its queries stay active: only
  // its scope keeps a resync from re-asking what nobody is looking at.
  describe('a home tab out of sight', () => {
    let shown: string | null | undefined;

    beforeEach(async () => {
      shown = 'ShoppingList';
      connectResyncSources(client, {
        onNavigation,
        scopeOnScreen: () => shown,
      });
      watchers.push(
        client
          .watchQuery({
            query: DetailQuery,
            context: { [RESYNC_SCOPE]: 'Pantry' },
          })
          .subscribe(() => {}),
      );
      await elapse(0);
      requests = [];
    });

    it('is left out of a resync', async () => {
      triggers.wsReconnected();
      await pastTheWindow();

      expect(requests).toEqual(['ListForResync']);
    });

    it('is re-asked once, when it is shown', async () => {
      triggers.wsReconnected();
      await pastTheWindow();
      requests = [];

      shown = 'Pantry';
      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);

      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);
    });

    it('is re-asked with the resync while it is the tab on screen', async () => {
      shown = 'Pantry';
      triggers.wsReconnected();
      await pastTheWindow();

      expect([...requests].sort()).toEqual([
        'DetailForResync',
        'ListForResync',
      ]);
    });

    it('stays unasked under a screen pushed over the tabs', async () => {
      shown = null;
      triggers.wsReconnected();
      await pastTheWindow();
      navigate();
      await pastTheWindow();

      expect(requests).toEqual(['ListForResync']);
    });

    it('is re-asked while the host cannot tell what is shown', async () => {
      shown = undefined;
      triggers.wsReconnected();
      await pastTheWindow();

      expect([...requests].sort()).toEqual([
        'DetailForResync',
        'ListForResync',
      ]);
    });
  });

  // Before, only a language switch caught a paused screen up.
  it('catches up a screen paused through a resync once it resumes', async () => {
    connectResyncSources(client, { onNavigation });
    const paused = client.watchQuery({ query: DetailQuery });
    const first = paused.subscribe(() => {});
    await elapse(0);
    first.unsubscribe();
    triggers.wsReconnected();
    await pastTheWindow();
    requests = [];

    watchers.push(paused.subscribe(() => {}));
    navigate();
    await pastTheWindow();

    expect(requests).toEqual(['DetailForResync']);
  });

  describe('the language catch-up', () => {
    beforeEach(() => {
      connectResyncSources(client, { onNavigation });
    });

    it('re-asks a screen paused at the switch once it resumes, and only it', async () => {
      // A screen beneath the one the switch was made on: paused, so its
      // query has no observer and no refetch reaches it.
      const paused = client.watchQuery({ query: DetailQuery });
      const first = paused.subscribe(() => {});
      await elapse(0);
      first.unsubscribe();
      requests = [];

      triggers.languageChanged();
      await pastTheWindow();
      expect(requests).toEqual(['ListForResync']);

      // Resuming reads the cache, still in the old language.
      requests = [];
      watchers.push(paused.subscribe(() => {}));
      await elapse(0);
      expect(requests).toEqual([]);

      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);
      expect(queueManager.whenIdle).toHaveBeenCalled();

      // Asked in this language now, as the list was at the switch, so the
      // catch-up does not even wait on the queue.
      jest.mocked(queueManager.whenIdle).mockClear();
      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);
      expect(queueManager.whenIdle).not.toHaveBeenCalled();
    });

    it('re-asks a screen first opened after the switch that reads the cache', async () => {
      // What the old language left in the cache.
      await client.query({ query: DetailQuery });
      triggers.languageChanged();
      await pastTheWindow();
      requests = [];

      watchers.push(
        client
          .watchQuery({ query: DetailQuery, fetchPolicy: 'cache-first' })
          .subscribe(() => {}),
      );
      await elapse(0);
      expect(requests).toEqual([]);

      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);

      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);
    });

    // The app's default: a screen opened after the switch asked the network as
    // it mounted, so a catch-up would ask every new screen twice.
    it('leaves a screen first opened after the switch that asked the network itself', async () => {
      triggers.languageChanged();
      await pastTheWindow();
      requests = [];

      watchers.push(
        client
          .watchQuery({
            query: DetailQuery,
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first',
          })
          .subscribe(() => {}),
      );
      await elapse(0);
      expect(requests).toEqual(['DetailForResync']);

      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);
    });

    it('asks nothing on navigation before a real switch', async () => {
      void changeLanguage(getResolvedLanguage());
      navigate();
      await pastTheWindow();

      expect(requests).toEqual([]);
      expect(navigationListeners.size).toBe(0);
    });

    // Per switch, not per language: the names are shared entities, so the
    // screens open in `es` wrote theirs over what the paused one reads.
    it('re-asks a screen paused through a switch and back', async () => {
      const paused = client.watchQuery({ query: DetailQuery });
      const first = paused.subscribe(() => {});
      triggers.appForeground();
      await pastTheWindow();
      first.unsubscribe();

      triggers.languageChanged();
      await pastTheWindow();
      triggers.languageChanged();
      await pastTheWindow();
      requests = [];

      watchers.push(paused.subscribe(() => {}));
      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['DetailForResync']);
    });

    it('re-asks on the next navigation a query whose catch-up failed', async () => {
      failing.add('ListForResync');
      triggers.languageChanged();
      await pastTheWindow();
      expect(requests).toEqual(['ListForResync']);

      failing.clear();
      requests = [];
      navigate();
      await pastTheWindow();
      expect(requests).toEqual(['ListForResync']);

      requests = [];
      navigate();
      await pastTheWindow();
      expect(requests).toEqual([]);
    });

    it('waits for the API to catch up', async () => {
      useStore.setState({ apiReachable: false });
      triggers.languageChanged();
      navigate();
      await pastTheWindow();

      expect(requests).toEqual([]);
    });

    // Each catch-up first waits on a full drain of the queue, which offline or
    // signed out only fails, once per navigation.
    it.each([
      ['offline', { apiReachable: false }],
      ['signed out', { user: null }],
    ] as const)(
      'makes no catch-up on a navigation while %s',
      async (_state, change) => {
        triggers.languageChanged();
        await pastTheWindow();
        jest.mocked(queueManager.whenIdle).mockClear();
        requests = [];

        useStore.setState(change);
        navigate();
        await pastTheWindow();

        expect(queueManager.whenIdle).not.toHaveBeenCalled();
        expect(requests).toEqual([]);
      },
    );

    // Rehydration applies the saved language after the sources subscribe.
    it('ignores a switch made before any query exists', async () => {
      watchers.splice(0).forEach(watcher => watcher.unsubscribe());
      triggers.languageChanged();
      await pastTheWindow();

      watch(ListQuery);
      await elapse(0);
      requests = [];
      navigate();
      await pastTheWindow();

      expect(requests).toEqual([]);
      expect(navigationListeners.size).toBe(0);
    });

    it('never re-asks a query that declined resync', async () => {
      triggers.languageChanged();
      await pastTheWindow();
      navigate();
      await pastTheWindow();

      expect(requests).not.toContain('SearchForResync');
    });
  });

  describe('a card the lookup answered with', () => {
    beforeEach(async () => {
      connectResyncSources(client, { onNavigation });
      // Before the resync, so the cache holds what may have missed a change.
      await client.query({ query: CardQuery, variables: { id: 'p1' } });
      await client.query({ query: PriceQuery, variables: { id: 'p1' } });
      triggers.wsReconnected();
      await pastTheWindow();
    });

    const scan = async (variables: { withPrice?: boolean } = {}) => {
      watchers.push(
        client
          .watchQuery({ query: LookupQuery, variables, refetchOn: false })
          .subscribe(() => {}),
      );
      await elapse(0);
    };
    const showCard = async (query: typeof CardQuery, id = 'p1') => {
      watchers.push(
        client
          .watchQuery({ query, variables: { id }, fetchPolicy: 'cache-first' })
          .subscribe(() => {}),
      );
      await elapse(0);
    };

    it('is not re-asked: the lookup brought what it reads', async () => {
      requests = [];
      await scan();
      await showCard(CardQuery);
      expect(requests).toEqual(['LookupForResync']);

      navigate();
      await pastTheWindow();

      expect(requests).toEqual(['LookupForResync']);
    });

    it('is re-asked when the lookup left its fragment out', async () => {
      requests = [];
      await scan({ withPrice: false });
      await showCard(PriceQuery);

      navigate();
      await pastTheWindow();

      expect(requests).toEqual(['LookupForResync', 'PriceForResync']);
    });

    it('is re-asked for a product the lookup did not bring', async () => {
      client.writeQuery({
        query: CardQuery,
        variables: { id: 'p2' },
        data: {
          product: { __typename: 'Product', id: 'p2', origin: 'FR' },
        },
      });
      requests = [];
      await scan();
      await showCard(CardQuery, 'p2');

      navigate();
      await pastTheWindow();

      expect(requests).toEqual(['LookupForResync', 'CardForResync']);
    });

    // The lookup declines resync, so its cards are the ones a resync refreshes.
    it('is re-asked by a resync that the lookup declines', async () => {
      await scan();
      await showCard(CardQuery);
      requests = [];

      triggers.wsReconnected();
      await pastTheWindow();

      expect([...requests].sort()).toEqual(['CardForResync', 'ListForResync']);
    });
  });

  it('does not refetch a query that declined resync', async () => {
    triggers.wsReconnected();
    await pastTheWindow();

    expect(requests).not.toContain('SearchForResync');
  });

  it('does not refetch while a session ends', async () => {
    const idle = deferred();
    jest.mocked(queueManager.whenIdle).mockReturnValueOnce(idle.promise);
    const release = deferred();
    const ending = whileSessionEnds(() => release.promise);

    triggers.appForeground();
    idle.resolve();
    await pastTheWindow();
    release.resolve();
    await ending;

    expect(requests).toEqual([]);
  });

  it('does not refetch for a trigger the ended session made', async () => {
    triggers.appForeground();
    await elapse(500);
    useStore.setState({ user: null });
    await pastTheWindow();

    expect(requests).toEqual([]);
  });

  it('does not refetch without a session', async () => {
    useStore.setState({ user: null });

    triggers.apiReachable();
    await pastTheWindow();

    expect(requests).toEqual([]);
  });

  describe('the settle window', () => {
    it('makes the socket re-ack a second after foreground one resync', async () => {
      triggers.appForeground();
      await elapse(1_000);
      triggers.wsReconnected();
      await elapse(1_000);
      expect(requests).toEqual([]);

      await pastTheWindow();

      expect(requests).toEqual(['ListForResync']);
      await waitFor(() =>
        expect(Telemetry.increment).toHaveBeenCalledWith(
          'resync_queries_total',
          1,
          { source: 'appForeground+wsReconnected' },
        ),
      );
    });

    it('resyncs for each of two triggers further apart than the window', async () => {
      triggers.appForeground();
      await elapse(2_000);
      expect(requests).toEqual(['ListForResync']);

      triggers.wsReconnected();
      await pastTheWindow();

      expect(requests).toEqual(['ListForResync', 'ListForResync']);
    });

    it('resyncs within 5 s of the first trigger however long triggers keep coming', async () => {
      triggers.wsReconnected();
      for (let second = 1; second < 5; second++) {
        await elapse(1_000);
        triggers.wsReconnected();
      }
      expect(requests).toEqual([]);

      await elapse(1_000);

      expect(requests).toEqual(['ListForResync']);
    });

    it('follows a resync with one more for triggers that arrive while it re-requests', async () => {
      const refetchQueries = jest.spyOn(client, 'refetchQueries');
      const inFlight = holdResponses();
      triggers.appForeground();
      await pastTheWindow();
      expect(requests).toEqual(['ListForResync']);

      triggers.wsReconnected();
      triggers.apiReachable();
      await pastTheWindow();
      expect(refetchQueries).toHaveBeenCalledTimes(1);

      inFlight.release();
      await pastTheWindow();
      await pastTheWindow();

      expect(requests).toEqual(['ListForResync', 'ListForResync']);
      await waitFor(() =>
        expect(Telemetry.increment).toHaveBeenLastCalledWith(
          'resync_queries_total',
          1,
          { source: 'apiReachable+wsReconnected' },
        ),
      );
    });
  });
});

afterAll(async () => {
  await changeLanguage('en');
});
