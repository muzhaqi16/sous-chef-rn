import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  recordMock,
  testMockLink,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { ErrorCode, UsualStoreSource } from '#/graphql/generated/schemaTypes';
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

/** A write's end: its answer waits on the clock, which only a test moves. */
const settled = async <T>(write: Promise<T>) => {
  await drainTimers();
  return write;
};

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
      testMockLink([refresh.mock, ...reasks.map(r => r.mock), pinMock.mock]),
    ]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const delivered: Array<boolean | undefined> = [];
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
      });
  };
  if (watchNow) watch();
  return {
    watch,
    cache,
    refresh,
    reasks,
    pinMock,
    forwarded,
    delivered,
    cached: (home = 'home-1') => readUsualStores(cache, home) ?? undefined,
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
  await drainTimers();
  expect(list.refresh.fired).toHaveLength(1);
  return list;
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('localWritePrecedenceLink', () => {
  it('shows a pin at once while the refresh is in flight', async () => {
    const list = await openWithRefreshInFlight({ pinHeld: true });

    const sent = list.pin();
    await drainTimers();

    expect(list.delivered.at(-1)).toBe(true);
    list.pinMock.release();
    await settled(sent);
    list.close();
  });

  it('keeps the pin when the refresh answers after the pin’s answer', async () => {
    const list = await openWithRefreshInFlight();
    const sent = list.pin();
    // Stops short of a drain, which would outrun the read fence: the refresh
    // is still in flight when the pin is answered.
    await jest.advanceTimersByTimeAsync(1000);
    expect(list.pinMock.fired).toHaveLength(1);

    list.refresh.release();
    await settled(sent);

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('keeps the pin when the refresh answers before the pin’s answer', async () => {
    const list = await openWithRefreshInFlight({ pinHeld: true });
    const sent = list.pin();
    await drainTimers();

    list.refresh.release();
    await drainTimers();
    expect(list.delivered.at(-1)).toBe(true);

    list.pinMock.release();
    await settled(sent);
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
          message: 'Too many stores',
          field: 'pinned',
        },
      },
    });
    await settled(list.pin());

    list.refresh.release();
    await drainTimers();

    expect(pinnedIn(list.cached())).toBe(false);
    expect(list.delivered.at(-1)).toBe(false);
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
    await drainTimers();
    expect(list.refresh.fired).toHaveLength(1);

    await settled(list.pin());
    list.refresh.release();
    await drainTimers();

    // Another home's list is no part of the pin: the server's answer stands.
    expect(list.cached('home-2')?.map(store => store.id)).toEqual([
      aldi.id,
      shadyside.id,
    ]);
    list.close();
  });

  it('keeps showing a write the queue holds, and its late read never replaces it', async () => {
    const list = await openWithRefreshInFlight({
      pin: { updateUsualStore: null },
    });
    await settled(list.pin());

    list.refresh.release();
    await drainTimers();

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('leaves a read that starts after the write alone', async () => {
    const list = open({ watchNow: false });
    await settled(list.pin());
    // The screen opens after the pin was sent, so its refresh is not caught.
    list.watch();
    await drainTimers();
    expect(list.refresh.fired).toHaveLength(1);

    list.refresh.release();
    await drainTimers();

    // Not caught: its answer is delivered as usual.
    expect(list.delivered.at(-1)).toBe(false);
    list.close();
  });

  it('sends nothing more for a write with no read loading', async () => {
    const list = open({
      watchNow: false,
      rereads: [[pinnedMarket, banksville]],
    });
    await settled(list.pin());

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.forwarded.map(op => op.name)).toEqual(['UpdateUsualStore']);
  });

  it('holds a read the cache cannot answer, and sends it again after the write', async () => {
    const list = await openWithRefreshInFlight({
      homeId: 'home-2',
      rereads: [[aldi]],
    });
    await settled(list.pin());

    list.refresh.release();
    await drainTimers();

    expect(list.reasks[0]?.fired).toHaveLength(1);
    expect(list.cached('home-2')?.map(store => store.id)).toEqual([aldi.id]);
    list.close();
  });

  it('holds a read sent again when a later write catches it as well', async () => {
    const refresh = recordMock(UsualStoresDocument, {
      data: { usualStores: [aldi] },
      held: true,
      maxUsageCount: 1,
    });
    const resent = recordMock(UsualStoresDocument, {
      data: { usualStores: [aldi] },
      held: true,
      maxUsageCount: 1,
    });
    const third = recordMock(UsualStoresDocument, {
      data: { usualStores: [aldi] },
      maxUsageCount: 1,
    });
    const pinMock = recordMock(UpdateUsualStoreDocument, {
      data: pinAnswer([pinnedMarket, banksville]),
      maxUsageCount: 2,
    });
    const cache = makeCache();
    writeUsualStores(cache, 'home-1', [banksville, market]);
    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([
        createLocalWritePrecedenceLink(),
        testMockLink([refresh.mock, resent.mock, third.mock, pinMock.mock]),
      ]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    const pin = () =>
      client.mutate({
        mutation: UpdateUsualStoreDocument,
        variables: {
          input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
        },
        context: { localFirst: true },
      });
    // Another household's list, which the cache cannot answer.
    const subscription = client
      .watchQuery({
        query: UsualStoresDocument,
        variables: { homeId: 'home-2' },
        fetchPolicy: 'cache-and-network',
      })
      .subscribe(() => undefined);
    await drainTimers();
    expect(refresh.fired).toHaveLength(1);

    await settled(pin());
    refresh.release();
    await drainTimers();
    expect(resent.fired).toHaveLength(1);

    // A second write while the read is out again: its answer is held too.
    await settled(pin());
    resent.release();
    await drainTimers();

    expect(third.fired).toHaveLength(1);
    subscription.unsubscribe();
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
    const client = new ApolloClient({
      cache,
      link: ApolloLink.from([
        createLocalWritePrecedenceLink(),
        testMockLink([page.mock, pinMock.mock]),
      ]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    let rows: string[] | undefined;
    // As `fetchMore` sends a page: its own no-cache request, marked.
    const loading = client
      .query({
        query: UsualStoresDocument,
        variables: { homeId: 'home-1' },
        fetchPolicy: 'no-cache',
        context: { page: true },
      })
      .then(({ data }) => {
        rows = data?.usualStores.map(store => store.id);
      });
    await drainTimers();
    expect(page.fired).toHaveLength(1);

    writeUsualStores(cache, 'home-1', [banksville, pinnedMarket]);
    await settled(
      client.mutate({
        mutation: UpdateUsualStoreDocument,
        variables: {
          input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
        },
        context: { localFirst: true },
      }),
    );
    page.release();
    await settled(loading);

    // The server's page, not the list the cache had merged.
    expect(rows).toEqual([aldi.id]);
    expect(pinnedIn(readUsualStores(cache, 'home-1'))).toBe(true);
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
