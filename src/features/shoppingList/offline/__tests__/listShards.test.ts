import {
  gql,
  type ApolloClient,
  type InMemoryCache,
  type NormalizedCacheObject,
} from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { FeedEngine } from '#/apollo/feed/feedEngine';
import { heldScopes, positionOf } from '#/apollo/feed/feedPositions';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { SyncPageStatus } from '#/graphql/generated/schemaTypes';
import { storage } from '#/store/deviceStorage';
import {
  clientOver,
  line,
  listed,
  page,
  pulled,
  wholeList,
  LIST,
} from '#/test-utils/feedServer';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useStore } from '#store';
import { forgetShardMemory, hydrateListShard, listShards } from '../listShards';

jest.mock('#/services/auth/deviceId');

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const OTHER = 'list-2';
const EAGER_KEY = 'apollo-cache-v1';
const shardKey = (id: string) => `apollo-shard:${id}`;

const row = (id: string) => ({
  __typename: 'ShoppingList',
  id,
  version: 1,
  homeId: 'home-1',
  isTemplate: false,
});

let lastSaved: NormalizedCacheObject | null = null;

/** What a persist does, with no debounce or flush burst between two saves. */
const save = (cache: InMemoryCache) => {
  const stored = cache.extract();
  storage.set(
    EAGER_KEY,
    JSON.stringify(listShards.save(cache, stored, lastSaved)),
  );
  lastSaved = stored;
};

const eager = () =>
  JSON.parse(storage.getString(EAGER_KEY) ?? '{}') as Record<string, unknown>;

const LIST_NAME = gql`
  fragment ShardListRow on ShoppingList {
    id
    version
  }
`;

const lines = (cache: InMemoryCache, id: string, isPurchased = false) =>
  cache
    .readQuery({
      query: GetShoppingListItemsFilteredDocument,
      variables: { id, first: 50, isPurchased },
    })
    ?.shoppingList?.itemsConnection.edges.map(edge => edge.node.id);

/** Two lists read in full, the way a device comes to hold them. */
async function deviceHolding(): Promise<InMemoryCache> {
  const client = clientOver({
    scopes: () =>
      listed([
        { id: LIST, cursor: 'latest' },
        { id: OTHER, cursor: 'latest' },
      ]),
    pull: ({ scopes }) =>
      pulled(
        scopes.map(({ id, cursor }) =>
          cursor === null
            ? page(id, { status: SyncPageStatus.ResyncRequired, cursor: null })
            : page(id, { cursor: 'latest' }),
        ),
      ),
    snapshot: ({ id }) =>
      wholeList([row(id), line(`${id}-a`, false, id)], { cursor: 'kept' }),
  });
  mockClient = client;
  const engine = new FeedEngine();
  engine.start();
  await engine.whenSettled();
  engine.stop();
  const cache = client.cache as InMemoryCache;
  apolloCachePersistence.attachShards(listShards, cache);
  return cache;
}

/** A new process: memory gone, the disk as the last save left it. */
function restart(): InMemoryCache {
  forgetShardMemory();
  const cache = makeCache();
  cache.restore(eager() as never);
  apolloCachePersistence.attachShards(listShards, cache);
  apolloCachePersistence.restoreShards();
  return cache;
}

beforeEach(() => {
  lastSaved = null;
  storage.clearAll();
  listShards.clear();
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    selectedShoppingListId: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  apolloCachePersistence.clear();
});

describe('what loads at launch', () => {
  it('holds no line of a held list, and every list’s own row', async () => {
    const cache = await deviceHolding();
    apolloCachePersistence.scheduleExtractAndSave(() => cache.extract());
    apolloCachePersistence.flushPending();

    expect(eager()).not.toHaveProperty(`ShoppingListItem:${LIST}-a`);
    expect(eager()).toHaveProperty(`ShoppingList:${LIST}`);
    expect(eager()).toHaveProperty(`ShoppingList:${OTHER}`);
    expect(Object.keys(eager()[`ShoppingList:${LIST}`] as object)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^(itemsConnection|collaboratorsConnection)/),
      ]),
    );
  });

  it('keeps a list the feed does not hold as it always did', async () => {
    const cache = await deviceHolding();
    forgetShardMemory();

    save(cache);

    expect(eager()).toHaveProperty(`ShoppingListItem:${LIST}-a`);
    expect(storage.contains(shardKey(LIST))).toBe(false);
  });
});

describe('each list on its own', () => {
  it('writes only the list that changed', async () => {
    const cache = await deviceHolding();
    save(cache);
    const set = jest.spyOn(storage, 'set');

    cache.modify({
      id: cache.identify({ __typename: 'ShoppingListItem', id: `${LIST}-a` }),
      fields: { itemName: () => 'Oat milk' },
    });
    save(cache);

    const written = set.mock.calls.map(([key]) => key);
    expect(written).toContain(shardKey(LIST));
    expect(written).not.toContain(shardKey(OTHER));
  });
});

describe('after a restart', () => {
  it('restores a position only with its rows', async () => {
    save(await deviceHolding());
    storage.remove(shardKey(OTHER));

    restart();

    expect(positionOf(LIST)?.cursor).toBe('latest');
    expect(positionOf(OTHER)).toBeUndefined();
  });

  it('opens a cold list from the device', async () => {
    save(await deviceHolding());
    const cache = restart();
    expect(lines(cache, LIST)).toBeUndefined();

    hydrateListShard(cache, LIST);

    expect(lines(cache, LIST)).toEqual([`${LIST}-a`]);
  });

  it('has the open list in memory before anything reads it', async () => {
    save(await deviceHolding());
    useStore.setState({ selectedShoppingListId: LIST });

    const cache = restart();

    expect(lines(cache, LIST)).toEqual([`${LIST}-a`]);
    expect(lines(cache, OTHER)).toBeUndefined();
  });

  it('has every stored list in memory while a write is queued', async () => {
    save(await deviceHolding());
    jest
      .spyOn(queueStore, 'getPendingWrites')
      .mockReturnValue([{ id: 'write-1' } as never]);

    const cache = restart();

    expect(lines(cache, LIST)).toEqual([`${LIST}-a`]);
    expect(lines(cache, OTHER)).toEqual([`${OTHER}-a`]);
  });

  it('keeps the list picker’s rows with every list cold', async () => {
    save(await deviceHolding());

    const cache = restart();

    expect(
      cache.readFragment({
        id: `ShoppingList:${LIST}`,
        fragment: LIST_NAME,
      }),
    ).toMatchObject({ id: LIST });
  });
});

describe('a stored copy that cannot be trusted', () => {
  it('discards one it cannot read, and the list reads in full', async () => {
    save(await deviceHolding());
    storage.set(shardKey(LIST), 'not json');
    const cache = restart();

    hydrateListShard(cache, LIST);

    expect(storage.contains(shardKey(LIST))).toBe(false);
    expect(positionOf(LIST)).toBeUndefined();
  });

  it('keeps the whole list when a cold list reads one page', async () => {
    save(await deviceHolding());
    const stored = storage.getString(shardKey(LIST));
    const cache = restart();

    cache.modify({
      id: `ShoppingList:${LIST}`,
      fields: { version: () => 9 },
    });
    save(cache);

    expect(storage.getString(shardKey(LIST))).toBe(stored);
  });

  it('keeps the last copy when the list reads incomplete, and reads it in full', async () => {
    const cache = await deviceHolding();
    save(cache);
    const stored = storage.getString(shardKey(LIST));

    cache.modify({
      id: cache.identify({ __typename: 'ShoppingListItem', id: `${LIST}-a` }),
      fields: { itemName: (_value, { DELETE }) => DELETE },
    });
    save(cache);

    expect(storage.getString(shardKey(LIST))).toBe(stored);
    expect(positionOf(LIST)).toBeUndefined();
  });
});

describe('leaving', () => {
  it('leaves no stored list behind', async () => {
    save(await deviceHolding());

    apolloCachePersistence.clear();

    expect(
      storage.getAllKeys().filter(key => key.startsWith('apollo-shard')),
    ).toEqual([]);
    expect(heldScopes().size).toBe(0);
  });
});
