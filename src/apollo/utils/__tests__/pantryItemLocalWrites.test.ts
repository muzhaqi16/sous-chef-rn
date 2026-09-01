/**
 * A locally-published pantry row and the header count above it are one
 * operation.
 *
 * They were two calls, and four of the six paths that do one forgot the other:
 * both quick-add paths published a row without counting it, and the queue's
 * permanent-failure handler withdrew a row without uncounting it. Offline no
 * response arrives to correct either, and `usePantryScreen` branches on this
 * count to choose server- against client-side sorting — so a stale one picks
 * the wrong mode as well as showing a wrong number.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  addPantryItemLocally,
  removePantryItemLocally,
  revertOptimisticPantryItem,
} from '../pantryCacheUpdaters';

const PANTRY = gql`
  query SeedPantry($id: ID!) {
    pantry(id: $id) {
      __typename
      id
      stats {
        __typename
        totalItems
      }
      itemsConnection {
        __typename
        totalCount
        edges {
          __typename
          cursor
          node {
            __typename
            id
          }
        }
      }
    }
  }
`;

function seed() {
  const cache = makeCache();
  cache.writeQuery({
    query: PANTRY,
    variables: { id: 'p-1' },
    data: {
      pantry: {
        __typename: 'Pantry',
        id: 'p-1',
        stats: { __typename: 'PantryStats', totalItems: 2 },
        itemsConnection: {
          __typename: 'PantryItemConnection',
          totalCount: 2,
          edges: [
            {
              __typename: 'PantryItemEdge',
              cursor: 'pi-1',
              node: { __typename: 'PantryItem', id: 'pi-1' },
            },
            {
              __typename: 'PantryItemEdge',
              cursor: 'pi-2',
              node: { __typename: 'PantryItem', id: 'pi-2' },
            },
          ],
        },
      },
    },
  });
  return cache;
}

/**
 * Write the entity before linking it, exactly as the production callers do
 * (`buildOptimisticPantryItem` first, then the connection write). A ref to an
 * entity the store has never seen is filtered out of the connection on read.
 */
const row = (id: string) => ({ __typename: 'PantryItem', id });

const writeRow = (cache: ReturnType<typeof makeCache>, id: string) =>
  cache.writeFragment({
    id: `PantryItem:${id}`,
    fragment: gql`
      fragment SeedRow on PantryItem {
        __typename
        id
      }
    `,
    data: { __typename: 'PantryItem', id },
  });

const state = (cache: ReturnType<typeof makeCache>) => {
  const read = cache.readQuery<{
    pantry: {
      stats: { totalItems: number };
      itemsConnection: { edges: unknown[] };
    };
  }>({ query: PANTRY, variables: { id: 'p-1' } });
  return {
    totalItems: read?.pantry?.stats?.totalItems,
    rows: read?.pantry?.itemsConnection?.edges?.length,
  };
};

describe('addPantryItemLocally', () => {
  it('moves the count with the row it adds', () => {
    const cache = seed();

    writeRow(cache, 'pi-3');
    addPantryItemLocally(cache, 'p-1', row('pi-3'));

    expect(state(cache)).toEqual({ totalItems: 3, rows: 3 });
  });

  it('does not count a row the duplicate guard refused to add', () => {
    const cache = seed();

    // What the barcode force-add does: republish the same id after a duplicate
    // refusal, so the row is tappable again while the retry is in flight.
    addPantryItemLocally(cache, 'p-1', row('pi-1'));

    expect(state(cache)).toEqual({ totalItems: 2, rows: 2 });
  });
});

describe('removePantryItemLocally', () => {
  it('moves the count with the row it withdraws', () => {
    const cache = seed();

    removePantryItemLocally(cache, 'p-1', 'pi-2');

    expect(state(cache)).toEqual({ totalItems: 1, rows: 1 });
  });

  it('leaves the count alone for a row that is not there', () => {
    const cache = seed();

    removePantryItemLocally(cache, 'p-1', 'pi-absent');

    expect(state(cache)).toEqual({ totalItems: 2, rows: 2 });
  });

  it('is idempotent across a repeated withdrawal', () => {
    const cache = seed();

    // The queue's failure handler and the call site's own revert can both run.
    removePantryItemLocally(cache, 'p-1', 'pi-2');
    removePantryItemLocally(cache, 'p-1', 'pi-2');

    expect(state(cache)).toEqual({ totalItems: 1, rows: 1 });
  });

  it('round-trips an add and its withdrawal', () => {
    const cache = seed();

    writeRow(cache, 'pi-3');
    addPantryItemLocally(cache, 'p-1', row('pi-3'));
    removePantryItemLocally(cache, 'p-1', 'pi-3');

    expect(state(cache)).toEqual({ totalItems: 2, rows: 2 });
  });
});

describe('revertOptimisticPantryItem', () => {
  const entityExists = (cache: ReturnType<typeof makeCache>, id: string) =>
    Object.prototype.hasOwnProperty.call(cache.extract(), `PantryItem:${id}`);

  it('reverses both counters a refused optimistic add moved', () => {
    const cache = seed();
    writeRow(cache, 'pi-3');
    addPantryItemLocally(cache, 'p-1', row('pi-3'));
    expect(state(cache)).toEqual({ totalItems: 3, rows: 3 });

    // What every add surface does with the server's DuplicatePantryItemError.
    revertOptimisticPantryItem(cache, 'p-1', 'pi-3');

    expect(state(cache)).toEqual({ totalItems: 2, rows: 2 });
  });

  it('evicts the entity so no detail read can resolve it', () => {
    const cache = seed();
    writeRow(cache, 'pi-3');
    addPantryItemLocally(cache, 'p-1', row('pi-3'));
    expect(entityExists(cache, 'pi-3')).toBe(true);

    revertOptimisticPantryItem(cache, 'p-1', 'pi-3');

    expect(entityExists(cache, 'pi-3')).toBe(false);
  });

  it('is idempotent — the force-add retry withdraws the same id twice', () => {
    const cache = seed();
    writeRow(cache, 'pi-3');
    addPantryItemLocally(cache, 'p-1', row('pi-3'));

    revertOptimisticPantryItem(cache, 'p-1', 'pi-3');
    revertOptimisticPantryItem(cache, 'p-1', 'pi-3');

    expect(state(cache)).toEqual({ totalItems: 2, rows: 2 });
  });

  it('leaves the counters alone for a row that was never published', () => {
    const cache = seed();

    revertOptimisticPantryItem(cache, 'p-1', 'pi-absent');

    expect(state(cache)).toEqual({ totalItems: 2, rows: 2 });
  });
});
