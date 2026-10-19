import { InMemoryCache } from '@apollo/client';
import {
  addPantryItemLocally,
  reconcileCreatedPantryItem,
  type PantryItemRef,
} from '../items';

const PANTRY = 'Pantry:pantry-1';
const EXPIRING = 'itemsConnection({"filters":{"expiringSoon":true}})';

const edge = (id: string) => ({
  __typename: 'PantryItemEdge',
  cursor: '',
  node: { __ref: `PantryItem:${id}` },
});

/** A pantry holding one stack, which its expiring-soon view leaves out. */
const cacheHolding = (heldId: string) => {
  const cache = new InMemoryCache();
  cache.restore({
    // Reachable from a query, as on device: the eviction's gc keeps it.
    ROOT_QUERY: { __typename: 'Query', pantry: { __ref: PANTRY } },
    [PANTRY]: {
      __typename: 'Pantry',
      id: 'pantry-1',
      itemsConnection: {
        __typename: 'PantryItemConnection',
        totalCount: 1,
        edges: [edge(heldId)],
      },
      [EXPIRING]: {
        __typename: 'PantryItemConnection',
        totalCount: 0,
        edges: [],
      },
    },
    [`PantryItem:${heldId}`]: { __typename: 'PantryItem', id: heldId },
  });
  return cache;
};

interface StoredConnection {
  totalCount: number;
  edges: { node: { __ref: string } }[];
}

const variant = (cache: InMemoryCache, field: string) => {
  const pantry = cache.extract()[PANTRY] as Record<string, StoredConnection>;
  const connection = pantry[field];
  return {
    totalCount: connection?.totalCount,
    rows: connection?.edges.map(({ node }) => node.__ref),
  };
};

const row = (id: string): PantryItemRef => ({ __typename: 'PantryItem', id });

describe('reconcileCreatedPantryItem', () => {
  // The write reaches every cached variant: adding the held row would put it
  // in, and count it toward, a filtered view it is not part of.
  it('leaves a restocked row where it already is, in every variant', () => {
    const cache = cacheHolding('held');
    addPantryItemLocally(cache, 'pantry-1', row('minted'));

    reconcileCreatedPantryItem(cache, 'pantry-1', row('held'), 'minted');

    expect(variant(cache, 'itemsConnection')).toEqual({
      totalCount: 1,
      rows: ['PantryItem:held'],
    });
    expect(variant(cache, EXPIRING)).toEqual({ totalCount: 0, rows: [] });
    expect(cache.extract()['PantryItem:minted']).toBeUndefined();
  });

  it('keeps the row and the count of a create the server took as written', () => {
    const cache = cacheHolding('held');
    addPantryItemLocally(cache, 'pantry-1', row('minted'));

    reconcileCreatedPantryItem(cache, 'pantry-1', row('minted'), 'minted');

    expect(variant(cache, 'itemsConnection')).toEqual({
      totalCount: 2,
      rows: ['PantryItem:minted', 'PantryItem:held'],
    });
  });
});
