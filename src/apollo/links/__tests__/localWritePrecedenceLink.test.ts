import { ApolloClient, ApolloLink, Observable, gql } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
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
  const client = new ApolloClient({
    cache,
    link: ApolloLink.from([
      createLocalWritePrecedenceLink(),
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

  it('passes a deferred read through untouched', async () => {
    const answer = { data: { me: { __typename: 'User', id: 'u1' } } };
    const forwarded: string[] = [];
    const terminal = new ApolloLink(operation => {
      forwarded.push(operation.operationName ?? '');
      return new Observable(observer => {
        observer.next(answer);
        observer.complete();
      });
    });
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
    const results: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      ApolloLink.execute(
        ApolloLink.from([createLocalWritePrecedenceLink(), terminal]),
        { query: deferred },
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

    expect(forwarded).toEqual(['DeferredMe']);
    expect(results).toEqual([answer]);
  });
});
