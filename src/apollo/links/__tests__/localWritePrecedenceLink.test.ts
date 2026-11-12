import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  recordMock,
  testMockLink,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { cacheShows, withDeadline } from '#/test-utils/cacheWaits';
import {
  ErrorCode,
  ErrorDisposition,
  UsualStoreSource,
} from '#/graphql/generated/schemaTypes';
import {
  readUsualStores,
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import { UpdateUsualStoreDocument } from '#features/catalog/hooks/useUsualStoreWrites.generated';
import type { PinUsualStoreInputs } from '#features/catalog/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { createLocalWritePrecedenceLink } from '../localWritePrecedenceLink';

const entry = (
  storeId: string,
  name: string,
  over: Partial<UsualStoreEntry> = {},
): UsualStoreEntry => ({
  __typename: 'UsualStore',
  id: `home-1:${storeId}`,
  addedVia: UsualStoreSource.Receipt,
  pinned: false,
  compared: true,
  lastUsedAt: '2026-10-20T12:00:00.000Z',
  store: { __typename: 'Store', id: storeId, name, address: null, chain: null },
  chain: null,
  ...over,
});

const banksville = entry('s1', 'Giant Eagle Banksville');
const market = entry('s2', 'Giant Eagle Market District');
const pinnedMarket = { ...market, pinned: true };
const aldi = entry('s3', 'ALDI Wilkinsburg', {
  addedVia: UsualStoreSource.Picked,
});

/** One task: Apollo tells its watchers of a cache write a task after it. */
const nextTask = () =>
  new Promise<void>(resolve => {
    setImmediate(resolve);
  });

type Stores =
  | ReadonlyArray<{ id?: string | null; pinned?: boolean | null } | null>
  | null
  | undefined;
const pinnedIn = (stores: Stores) =>
  stores?.find(store => store?.id === market.id)?.pinned ?? undefined;

type PinAnswer = MockDataFor<typeof UpdateUsualStoreDocument>;
const pinAnswer = (stores: UsualStoreEntry[]): PinAnswer => ({
  updateUsualStore: {
    __typename: 'UpdateUsualStorePayload',
    usualStores: stores,
  },
});

/**
 * Your stores open from the cache, its refresh held with `refreshed`, behind
 * this link. A `cache-first` home has no cached list, for the fallback.
 */
function open({
  refreshed = [banksville, market],
  pin = pinAnswer([pinnedMarket, banksville]),
  pinHeld = false,
  rereads = [] as UsualStoreEntry[][],
  homeId = 'home-1',
  watchNow = true,
} = {}) {
  const refresh = recordMock(UsualStoresDocument, {
    data: { usualStores: refreshed },
    held: true,
    maxUsageCount: 1,
  });
  const reasks = rereads.map(stores =>
    recordMock(UsualStoresDocument, {
      data: { usualStores: stores },
      maxUsageCount: 1,
    }),
  );
  const pinMock = recordMock(UpdateUsualStoreDocument, {
    data: pin,
    held: pinHeld,
  });
  const cache = makeCache();
  writeUsualStores(cache, 'home-1', [banksville, market]);
  const log = operationLog();
  /** Each operation the link passes on, as the rest of the chain sees it. */
  const forwarded: Array<{ name: string | undefined }> = [];
  const client = new ApolloClient({
    cache,
    link: ApolloLink.from([
      createLocalWritePrecedenceLink(),
      new ApolloLink((operation, forward) => {
        forwarded.push({ name: operation.operationName });
        return forward(operation);
      }),
      log.link,
      testMockLink([refresh.mock, ...reasks.map(r => r.mock), pinMock.mock]),
    ]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const delivered: Array<boolean | undefined> = [];
  const onDelivery = new Set<() => void>();
  let subscription: { unsubscribe: () => void } | undefined;
  const watch = () => {
    subscription = client
      .watchQuery({
        query: UsualStoresDocument,
        variables: { homeId },
        fetchPolicy: 'cache-and-network',
      })
      .subscribe(result => {
        delivered.push(pinnedIn(result.data?.usualStores));
        onDelivery.forEach(check => check());
      });
  };
  if (watchNow) watch();
  return {
    watch,
    log,
    cache,
    refresh,
    reasks,
    pinMock,
    forwarded,
    delivered,
    cached: (home = 'home-1') => readUsualStores(cache, home) ?? undefined,
    /** Resolves once the watcher's latest delivery shows the pin as `pinned`. */
    delivers: (pinned: boolean) =>
      withDeadline(
        done => {
          const check = () => {
            if (delivered.at(-1) === pinned) done();
          };
          onDelivery.add(check);
          check();
          return () => onDelivery.delete(check);
        },
        () => `the watcher last delivered ${String(delivered.at(-1))}`,
      ),
    /**
     * Resolves once the list `home` holds satisfies `ok`, then a task more for
     * its watcher. A refused write's layer gives way only when layers rebuild.
     */
    settlesTo: async (
      ok: (stores: UsualStoreEntry[] | undefined) => boolean,
      home = 'home-1',
    ) => {
      await cacheShows(
        cache,
        { query: UsualStoresDocument, variables: { homeId: home } },
        () => readUsualStores(cache, home) ?? undefined,
        ok,
      );
      await nextTask();
    },
    /** The pin as `useUsualStoreWrites` sends it. */
    pin: () => {
      const inputs: PinUsualStoreInputs = {
        homeId: 'home-1',
        choice: { store: { id: 's2', name: 'Giant Eagle Market District' } },
        pinned: true,
        now: '2026-10-30T10:00:00.000Z',
      };
      return pendingWritesOf(cache).send(
        UpdateUsualStoreDocument,
        {
          input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
        },
        write =>
          settleMutation(
            () =>
              client.mutate({ mutation: UpdateUsualStoreDocument, ...write }),
            {
              document: UpdateUsualStoreDocument,
              fallback: 'Refused',
              present: 'none',
            },
          ),
        inputs,
      );
    },
    close: () => subscription?.unsubscribe(),
  };
}

const openWithRefreshInFlight = async (
  options?: Parameters<typeof open>[0],
) => {
  const list = open(options);
  await list.log.requested(UsualStoresDocument);
  expect(list.refresh.fired).toHaveLength(1);
  return list;
};

describe('localWritePrecedenceLink', () => {
  it('shows a pin at once while the refresh is in flight', async () => {
    const list = await openWithRefreshInFlight({ pinHeld: true });

    const sent = list.pin();
    await list.log.requested(UpdateUsualStoreDocument);
    await nextTask();

    expect(list.delivered.at(-1)).toBe(true);
    list.pinMock.release();
    await sent;
    list.close();
  });

  it('keeps the pin when the refresh answers after the pin’s answer', async () => {
    const list = await openWithRefreshInFlight();
    const sent = list.pin();
    // The refresh is still in flight when the pin is answered.
    await list.log.answered(UpdateUsualStoreDocument);
    expect(list.pinMock.fired).toHaveLength(1);

    list.refresh.release();
    await sent;

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('keeps the pin when the refresh answers before the pin’s answer', async () => {
    const list = await openWithRefreshInFlight({ pinHeld: true });
    const sent = list.pin();
    await list.log.requested(UpdateUsualStoreDocument);

    list.refresh.release();
    await list.log.answered(UsualStoresDocument);
    await nextTask();
    expect(list.delivered.at(-1)).toBe(true);

    list.pinMock.release();
    await sent;
    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('ends on the server’s state when the write is refused and undone', async () => {
    const list = await openWithRefreshInFlight({
      pin: {
        updateUsualStore: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          disposition: ErrorDisposition.Fail,
          message: 'Too many stores',
          field: 'pinned',
        },
      },
    });
    await list.pin();

    list.refresh.release();
    await list.log.answered(UsualStoresDocument);
    await list.settlesTo(stores => pinnedIn(stores) === false);

    await list.delivers(false);
    list.close();
  });

  it('leaves a read alone when the write did not change its data', async () => {
    const shadyside = entry('s4', 'Giant Eagle Shadyside');
    const list = open({
      homeId: 'home-2',
      watchNow: false,
      refreshed: [aldi, shadyside],
    });
    writeUsualStores(list.cache, 'home-2', [aldi]);
    list.watch();
    await list.log.requested(UsualStoresDocument);
    expect(list.refresh.fired).toHaveLength(1);

    await list.pin();
    list.refresh.release();
    await list.log.answered(UsualStoresDocument);

    // Another home's list is no part of the pin: the server's answer stands.
    await list.settlesTo(
      stores =>
        JSON.stringify(stores?.map(store => store.id)) ===
        JSON.stringify([aldi.id, shadyside.id]),
      'home-2',
    );
    list.close();
  });

  it('keeps showing a write the queue holds, and its late read never replaces it', async () => {
    const list = await openWithRefreshInFlight({
      pin: { updateUsualStore: null },
    });
    await list.pin();

    list.refresh.release();
    await list.log.answered(UsualStoresDocument);
    await nextTask();

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('leaves a read that starts after the write alone', async () => {
    const list = open({ watchNow: false });
    await list.pin();
    // The screen opens after the pin was sent, so its refresh is not caught.
    list.watch();
    await list.log.requested(UsualStoresDocument);
    expect(list.refresh.fired).toHaveLength(1);

    list.refresh.release();
    await list.log.answered(UsualStoresDocument);
    await list.settlesTo(stores => pinnedIn(stores) === false);

    // Not caught: its answer is delivered as usual.
    await list.delivers(false);
    list.close();
  });

  it('sends nothing more for a write with no read loading', async () => {
    const list = open({
      watchNow: false,
      rereads: [[pinnedMarket, banksville]],
    });
    await list.pin();

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.forwarded.map(op => op.name)).toEqual(['UpdateUsualStore']);
  });

  it('lets a read the cache cannot answer land as the server sends it, sent once', async () => {
    const list = await openWithRefreshInFlight({
      homeId: 'home-2',
      refreshed: [aldi],
      rereads: [[aldi]],
    });
    await list.pin();

    list.refresh.release();
    await list.log.answered(UsualStoresDocument);
    await nextTask();

    expect(list.reasks[0]?.fired).toHaveLength(0);
    expect(list.cached('home-2')?.map(store => store.id)).toEqual([aldi.id]);
    list.close();
  });

  it('lets a page loading during a write land as the server sends it', async () => {
    const page = recordMock(UsualStoresDocument, {
      data: { usualStores: [aldi] },
      held: true,
      maxUsageCount: 1,
    });
    const pinMock = recordMock(UpdateUsualStoreDocument, {
      data: pinAnswer([pinnedMarket, banksville]),
    });
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [banksville, market]);
    const log = operationLog();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([
        createLocalWritePrecedenceLink(),
        log.link,
        testMockLink([page.mock, pinMock.mock]),
      ]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    let rows: string[] | undefined;
    // As `fetchPage` sends one: its own no-cache request, marked.
    const loading = client
      .query({
        query: UsualStoresDocument,
        variables: { homeId: 'home-1' },
        fetchPolicy: 'no-cache',
        context: { page: true, oneShot: true },
      })
      .then(({ data }) => {
        rows = data?.usualStores.map(store => store.id);
      });
    await log.requested(UsualStoresDocument);
    expect(page.fired).toHaveLength(1);

    writeUsualStores(cache, 'home-1', [banksville, pinnedMarket]);
    await client.mutate({
      mutation: UpdateUsualStoreDocument,
      variables: {
        input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
      },
      context: { localFirst: true },
    });
    page.release();
    await loading;

    // The server's page, not the list the cache had merged.
    expect(rows).toEqual([aldi.id]);
    expect(pinnedIn(readUsualStores(cache, 'home-1'))).toBe(true);
  });

  it('gives a one-shot read the server’s answer, whatever a write changes', async () => {
    const read = recordMock(UsualStoresDocument, {
      data: { usualStores: [aldi] },
      held: true,
      maxUsageCount: 1,
    });
    const pinMock = recordMock(UpdateUsualStoreDocument, {
      data: pinAnswer([pinnedMarket, banksville]),
    });
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [banksville, market]);
    const log = operationLog();
    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([
        createLocalWritePrecedenceLink(),
        log.link,
        testMockLink([read.mock, pinMock.mock]),
      ]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    let answer: string[] | undefined;
    // No `context`: the client's default marks every `client.query`.
    const asking = client
      .query({
        query: UsualStoresDocument,
        variables: { homeId: 'home-1' },
        fetchPolicy: 'network-only',
      })
      .then(({ data }) => {
        answer = data?.usualStores.map(store => store.id);
      });
    await log.requested(UsualStoresDocument);
    expect(read.fired).toHaveLength(1);

    writeUsualStores(cache, 'home-1', [banksville, pinnedMarket]);
    await client.mutate({
      mutation: UpdateUsualStoreDocument,
      variables: {
        input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
      },
      context: { localFirst: true },
    });
    expect(answer).toBeUndefined();

    read.release();
    await asking;

    expect(answer).toEqual([aldi.id]);
  });

  it('passes a deferred read through untouched', async () => {
    const answer = { data: { me: { __typename: 'User', id: 'u1' } } };
    const deferred = gql`
      query DeferredMe {
        me {
          id
          ... @defer {
            email
          }
        }
      }
    `;

    const { forwarded, results } = await passThrough(deferred, answer);

    expect(forwarded).toEqual(['DeferredMe']);
    expect(results).toEqual([answer]);
  });

  it('passes a subscription through untouched', async () => {
    const answer = { data: { ping: 'pong' } };
    const ping = gql`
      subscription Ping {
        ping
      }
    `;

    const { forwarded, results } = await passThrough(ping, answer);

    expect(forwarded).toEqual(['Ping']);
    expect(results).toEqual([answer]);
  });
});

/** Runs one operation through the link alone, answered once by `answer`. */
async function passThrough(query: DocumentNode, answer: ApolloLink.Result) {
  const forwarded: string[] = [];
  const terminal = new ApolloLink(operation => {
    forwarded.push(operation.operationName ?? '');
    return new Observable(observer => {
      observer.next(answer);
      observer.complete();
    });
  });
  const results: unknown[] = [];
  await new Promise<void>((resolve, reject) => {
    ApolloLink.execute(
      ApolloLink.from([createLocalWritePrecedenceLink(), terminal]),
      { query },
      {
        client: new ApolloClient({
          cache: makeCache(),
          link: terminal,
          defaultOptions: APOLLO_DEFAULT_OPTIONS,
        }),
      },
    ).subscribe({
      next: value => results.push(value),
      error: reject,
      complete: resolve,
    });
  });
  return { forwarded, results };
}
