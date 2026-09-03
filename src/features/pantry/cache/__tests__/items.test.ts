import { InMemoryCache } from '@apollo/client';
('use no memo');

// Break the circular dependency chain these modules sit in.
jest.mock('../../links/tokenScheduler');
jest.mock('../../links/refreshToken');

jest.mock('../cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

import {
  addToPantryItemsCache,
  adjustPantryItemCount,
  removeFromPantryItemsCache,
} from '../pantryCacheUpdaters';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '../cacheUpdaters';

/**
 * These updaters were declared twice — once in `hooks/home/pantry/utils.ts` and
 * once in `features/pantry/hooks/mutations/utils.ts` — from the same factory
 * with the same three arguments. The arguments are what this asserts, because
 * they are what a second declaration could get subtly wrong: a different
 * connection field name would write to the wrong list and fail silently.
 */
describe('pantryCacheUpdaters', () => {
  it('adds to Pantry.itemsConnection, keyed on PantryItem', () => {
    expect(createAddToParentConnectionUpdater).toHaveBeenCalledWith(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    expect(typeof addToPantryItemsCache).toBe('function');
  });

  it('removes from the same connection with the same key', () => {
    expect(createRemoveFromParentConnectionUpdater).toHaveBeenCalledWith(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    expect(typeof removeFromPantryItemsCache).toBe('function');
  });
});

const PANTRY_ID = 'pantry-1';

function cacheWithStats(totalItems: number) {
  const cache = new InMemoryCache();
  cache.restore({
    [`Pantry:${PANTRY_ID}`]: {
      __typename: 'Pantry',
      id: PANTRY_ID,
      stats: { __typename: 'PantryStats', totalItems },
    },
  });
  return cache;
}

function readTotal(cache: InMemoryCache): number | undefined {
  const extracted = cache.extract() as Record<
    string,
    { stats?: { totalItems?: number } }
  >;
  return extracted[`Pantry:${PANTRY_ID}`]?.stats?.totalItems;
}

describe('adjustPantryItemCount', () => {
  it('increments on a local add', () => {
    const cache = cacheWithStats(63);
    adjustPantryItemCount(cache, PANTRY_ID, 1);
    expect(readTotal(cache)).toBe(64);
  });

  it('decrements on a local remove', () => {
    const cache = cacheWithStats(64);
    adjustPantryItemCount(cache, PANTRY_ID, -1);
    expect(readTotal(cache)).toBe(63);
  });

  it('never goes below zero', () => {
    const cache = cacheWithStats(0);
    adjustPantryItemCount(cache, PANTRY_ID, -1);
    expect(readTotal(cache)).toBe(0);
  });

  it('leaves an uncached pantry alone rather than inventing stats', () => {
    const cache = new InMemoryCache();
    expect(() => adjustPantryItemCount(cache, PANTRY_ID, 1)).not.toThrow();
    expect(readTotal(cache)).toBeUndefined();
  });
});
