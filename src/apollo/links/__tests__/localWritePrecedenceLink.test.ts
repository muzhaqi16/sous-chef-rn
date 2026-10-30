import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import type { DocumentNode } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  recordMock,
  testMockLink,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode, UsualStoreSource } from '#/graphql/generated/schemaTypes';
import {
  readUsualStores,
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import { UpdateUsualStoreDocument } from '#features/catalog/hooks/useUsualStoreWrites.generated';
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
const tick = () => new Promise(resolve => setTimeout(resolve, 50));

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
  context = {},
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
  const forwarded: Array<{
    name: string | undefined;
    context: Record<string, unknown>;
  }> = [];
  const client = new ApolloClient({
    cache,
    link: ApolloLink.from([
      createLocalWritePrecedenceLink(),
      new ApolloLink((operation, forward) => {
        forwarded.push({
          name: operation.operationName,
          context: operation.getContext(),
        });
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
        context,
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
    /** The pin as a hook sends it: written first, then sent local-first. */
    pin: () => {
      writeUsualStores(cache, 'home-1', [banksville, pinnedMarket]);
      return client.mutate({
        mutation: UpdateUsualStoreDocument,
        variables: {
          input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
        },
        context: { localFirst: true },
      });
    },
    close: () => subscription?.unsubscribe(),
  };
}

const openWithRefreshInFlight = async (
  options?: Parameters<typeof open>[0],
) => {
  const list = open(options);
  await waitFor(() => expect(list.refresh.fired).toHaveLength(1));
  await act(tick);
  return list;
};

describe('localWritePrecedenceLink', () => {
  it('shows a pin at once while the refresh is in flight', async () => {
    const list = await openWithRefreshInFlight();

    let sent: Promise<unknown> | undefined;
    await act(async () => {
      sent = list.pin();
      await tick();
    });

    expect(list.delivered.at(-1)).toBe(true);
    await act(async () => {
      await sent;
    });
    list.close();
  });

  it('keeps the pin when the refresh answers after the pin’s answer', async () => {
    const list = await openWithRefreshInFlight();
    await act(async () => {
      await list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('keeps the pin when the refresh answers before the pin’s answer', async () => {
    const list = await openWithRefreshInFlight({ pinHeld: true });
    let sent: Promise<unknown> | undefined;
    await act(async () => {
      sent = list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });
    expect(list.delivered.at(-1)).toBe(true);

    await act(async () => {
      list.pinMock.release();
      await sent;
      await tick();
    });
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
    await act(async () => {
      await list.pin();
      // The hook's refusal path puts the list back.
      writeUsualStores(list.cache, 'home-1', [banksville, market]);
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    expect(pinnedIn(list.cached())).toBe(false);
    expect(list.delivered.at(-1)).toBe(false);
    list.close();
  });

  it('asks again once when the late answer brings another member’s change', async () => {
    const list = await openWithRefreshInFlight({
      refreshed: [banksville, market, aldi],
      rereads: [[pinnedMarket, banksville, aldi]],
    });
    await act(async () => {
      await list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    await waitFor(() => expect(list.reasks[0]?.fired).toHaveLength(1));
    await act(tick);
    expect(list.cached()?.map(store => store.id)).toEqual([
      market.id,
      banksville.id,
      aldi.id,
    ]);
    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('asks again with the context the read was sent with', async () => {
    const list = await openWithRefreshInFlight({
      refreshed: [banksville, market, aldi],
      rereads: [[pinnedMarket, banksville, aldi]],
      context: { allowDuringLogout: true },
    });
    await act(async () => {
      await list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    await waitFor(() => expect(list.reasks[0]?.fired).toHaveLength(1));
    const reads = list.forwarded.filter(op => op.name === 'UsualStores');
    expect(reads).toHaveLength(2);
    expect(reads[1]?.context.allowDuringLogout).toBe(true);
    list.close();
  });

  it('leaves a read alone when the write did not change its data', async () => {
    const shadyside = entry('s4', 'Giant Eagle Shadyside');
    const list = open({
      homeId: 'home-2',
      watchNow: false,
      refreshed: [aldi, shadyside],
      rereads: [[aldi, shadyside]],
    });
    writeUsualStores(list.cache, 'home-2', [aldi]);
    list.watch();
    await waitFor(() => expect(list.refresh.fired).toHaveLength(1));
    await act(tick);

    await act(async () => {
      await list.pin();
      await tick();
    });
    await act(async () => {
      list.refresh.release();
      await tick();
      await tick();
    });

    // Another home's list is no part of the pin: the server's answer stands.
    expect(list.cached('home-2')?.map(store => store.id)).toEqual([
      aldi.id,
      shadyside.id,
    ]);
    expect(list.reasks[0]?.fired).toHaveLength(0);
    list.close();
  });

  it('keeps showing a write the queue holds, and its late read never replaces it', async () => {
    const list = await openWithRefreshInFlight({
      pin: { updateUsualStore: null },
    });
    await act(async () => {
      await list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.delivered.at(-1)).toBe(true);
    list.close();
  });

  it('does not ask again when the late answer agrees with the device', async () => {
    const list = await openWithRefreshInFlight({
      refreshed: [banksville, pinnedMarket],
      rereads: [[banksville, pinnedMarket]],
    });
    await act(async () => {
      await list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
      await tick();
    });

    expect(list.reasks[0]?.fired).toHaveLength(0);
    list.close();
  });

  it('leaves a read that starts after the write alone', async () => {
    const list = open({ watchNow: false });
    await act(async () => {
      await list.pin();
      await tick();
    });
    // The screen opens after the pin was sent, so its refresh is not caught.
    list.watch();
    await waitFor(() => expect(list.refresh.fired).toHaveLength(1));

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    // Not caught: its answer is delivered as usual.
    expect(list.delivered.at(-1)).toBe(false);
    list.close();
  });

  it('sends nothing more for a write with no read loading', async () => {
    const list = open({
      watchNow: false,
      rereads: [[pinnedMarket, banksville]],
    });
    await act(async () => {
      await list.pin();
      await tick();
    });

    expect(pinnedIn(list.cached())).toBe(true);
    expect(list.forwarded.map(op => op.name)).toEqual(['UpdateUsualStore']);
  });

  it('holds a read the cache cannot answer, and sends it again after the write', async () => {
    const list = await openWithRefreshInFlight({
      homeId: 'home-2',
      rereads: [[aldi]],
    });
    await act(async () => {
      await list.pin();
      await tick();
    });

    await act(async () => {
      list.refresh.release();
      await tick();
    });

    await waitFor(() => expect(list.reasks[0]?.fired).toHaveLength(1));
    await act(tick);
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
    await waitFor(() => expect(refresh.fired).toHaveLength(1));

    await act(async () => {
      await pin();
      refresh.release();
      await tick();
    });
    await waitFor(() => expect(resent.fired).toHaveLength(1));

    // A second write while the read is out again: its answer is held too.
    await act(async () => {
      await pin();
      resent.release();
      await tick();
    });

    await waitFor(() => expect(third.fired).toHaveLength(1));
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
    await waitFor(() => expect(page.fired).toHaveLength(1));

    await act(async () => {
      writeUsualStores(cache, 'home-1', [banksville, pinnedMarket]);
      await client.mutate({
        mutation: UpdateUsualStoreDocument,
        variables: {
          input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
        },
        context: { localFirst: true },
      });
    });
    await act(async () => {
      page.release();
      await loading;
    });

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
