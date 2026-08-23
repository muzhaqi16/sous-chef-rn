'use no memo';

// Break the circular dependency chain these modules sit in.
jest.mock('../../links/tokenScheduler');
jest.mock('../../links/refreshToken');

jest.mock('../cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

import {
  addToPantryItemsCache,
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
