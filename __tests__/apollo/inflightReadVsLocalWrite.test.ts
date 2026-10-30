import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { recordMock, testMockLink } from '#/test-utils/apolloMockProvider';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import {
  readUsualStores,
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import { UpdateUsualStoreDocument } from '#features/catalog/hooks/useUsualStoreWrites.generated';

/**
 * Apollo Client 4.2.12, with no link of ours: what a `cache-and-network`
 * watcher shows while its read is in flight, and what that read's late answer
 * does to a newer write. Verified:
 * `#apollo-a-read-in-flight-hides-a-newer-write-then-overwrites-it`.
 */

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
const VARIABLES = { homeId: 'home-1' };
const tick = () => new Promise(resolve => setTimeout(resolve, 50));

type Stores =
  | ReadonlyArray<{ id?: string | null; pinned?: boolean | null } | null>
  | null
  | undefined;
const pinnedIn = (stores: Stores) =>
  stores?.find(store => store?.id === market.id)?.pinned ?? undefined;

/** The list open from the cache, its refresh held, with the list before the pin. */
function openWithRefreshHeld(extraLinks: ApolloLink[] = []) {
  const refresh = recordMock(UsualStoresDocument, {
    data: { usualStores: [banksville, market] },
    held: true,
  });
  const pin = recordMock(UpdateUsualStoreDocument, {
    data: {
      updateUsualStore: {
        __typename: 'UpdateUsualStorePayload',
        usualStores: [{ ...market, pinned: true }, banksville],
      },
    },
  });
  const cache = makeCache();
  writeUsualStores(cache, 'home-1', [banksville, market]);
  const client = new ApolloClient({
    cache,
    link: ApolloLink.from([
      ...extraLinks,
      testMockLink([refresh.mock, pin.mock]),
    ]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const delivered: Array<boolean | undefined> = [];
  const watcher = client.watchQuery({
    query: UsualStoresDocument,
    variables: VARIABLES,
    fetchPolicy: 'cache-and-network',
  });
  const subscription = watcher.subscribe(result => {
    delivered.push(pinnedIn(result.data?.usualStores));
  });
  return {
    cache,
    client,
    refresh,
    delivered,
    cached: () => pinnedIn(readUsualStores(cache, 'home-1') ?? undefined),
    pinLocally: () =>
      writeUsualStores(cache, 'home-1', [
        banksville,
        { ...market, pinned: true },
      ]),
    close: () => subscription.unsubscribe(),
  };
}

describe('a read in flight against a newer local write (Apollo 4.2.12)', () => {
  it('hides the write and the server’s answer to it, then overwrites both', async () => {
    const list = openWithRefreshHeld();
    await waitFor(() => expect(list.refresh.fired).toHaveLength(1));
    await act(tick);
    expect(list.delivered).toEqual([false]);

    list.pinLocally();
    await act(tick);
    // The cache holds the write; the watcher delivers nothing while its read is out.
    expect(list.cached()).toBe(true);
    expect(list.delivered).toEqual([false]);

    await act(async () => {
      await list.client.mutate({
        mutation: UpdateUsualStoreDocument,
        variables: {
          input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true },
        },
      });
      await tick();
    });
    // The server's answer to the pin is not delivered either.
    expect(list.cached()).toBe(true);
    expect(list.delivered).toEqual([false]);

    await act(async () => {
      list.refresh.release();
      await tick();
    });
    // The late answer, from before the pin, is written last.
    expect(list.cached()).toBe(false);
    expect(list.delivered).toEqual([false, false]);
    list.close();
  });

  it('delivers at once when the read in flight is answered from the cache, and drops its late answer', async () => {
    const answers: Array<() => void> = [];
    const answerFromCache = new ApolloLink((operation, forward) => {
      if (operation.operationName !== operationNameOf(UsualStoresDocument)) {
        return forward(operation);
      }
      return new Observable(observer => {
        let answered = false;
        const network = forward(operation).subscribe({
          next: value => {
            if (!answered) observer.next(value);
          },
          error: (error: unknown) => {
            if (!answered) observer.error(error);
          },
          complete: () => {
            if (!answered) observer.complete();
          },
        });
        answers.push(() => {
          const { result } = list.cache.diff<Record<string, unknown>>({
            query: operation.query,
            variables: operation.variables,
            returnPartialData: false,
            optimistic: false,
          });
          // Emitted while the subscriber is open: closing the network first
          // closes it, and the watcher never hears the answer.
          answered = true;
          observer.next({ data: result });
          observer.complete();
        });
        return () => network.unsubscribe();
      });
    });
    const list = openWithRefreshHeld([answerFromCache]);
    await waitFor(() => expect(list.refresh.fired).toHaveLength(1));
    await act(tick);
    list.pinLocally();
    await act(tick);
    expect(list.delivered).toEqual([false]);

    await act(async () => {
      answers[0]?.();
      await tick();
    });
    expect(list.delivered).toEqual([false, true]);

    await act(async () => {
      list.refresh.release();
      await tick();
    });
    expect(list.cached()).toBe(true);
    expect(list.delivered).toEqual([false, true]);
    list.close();
  });
});
