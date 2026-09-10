/**
 * Withdrawing a line to the pantry and restoring it, against a mocked
 * `cache.modify`. The counter arithmetic has its own suite in
 * `moveToPantryCounters.test.ts`, against the real cache.
 */

import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
} from '../moveToPantry';
import {
  createFieldHelpers,
  createMockCache,
  invokeFieldModifier,
} from './helpers/mockCache';
import type { MockRef } from './helpers/mockCache';
import { logger } from '#/utils/environment';

describe('move-to-pantry unlink and restore', () => {
  beforeEach(jest.clearAllMocks);

  it('evicts the entity on the confirmed path', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    expect(cache.evict).toHaveBeenCalled();
  });

  it('keeps the entity when the removal is only eager', () => {
    // Offline the row is unlinked before the server has agreed. Evicting here
    // is what made a permanently-refused replay lose the item from BOTH lists:
    // the queue withdrew the PantryItem it created, and there was nothing left
    // to put back on the shopping side.
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false, {
      evictEntity: false,
    });

    expect(cache.modify).toHaveBeenCalled();
    expect(cache.evict).not.toHaveBeenCalled();
  });

  it('re-adds the edge and the counters on withdrawal', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue({
      id: 'sli-1',
      purchaseInfo: { isPurchased: false },
      shoppingList: { id: 'sl-1' },
    });

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-9');
    helpers.toReference.mockReturnValue({ __ref: 'ShoppingListItem:sli-1' });

    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      { edges: [{ node: { __ref: 'ShoppingListItem:sli-9' } }], totalCount: 1 },
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('restores into the variant the row actually belongs to', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue({
      id: 'sli-1',
      purchaseInfo: { isPurchased: true },
      shoppingList: { id: 'sl-1' },
    });

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = { edges: [], totalCount: 0 };

    expect(
      invokeFieldModifier(cache, 'itemsConnection', existing, helpers),
    ).toBe(existing);
  });

  it('is idempotent — a second withdrawal does not duplicate the row', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue({
      id: 'sli-1',
      purchaseInfo: { isPurchased: false },
      shoppingList: { id: 'sl-1' },
    });

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-1');
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };

    expect(
      invokeFieldModifier(cache, 'itemsConnection', existing, helpers),
    ).toBe(existing);
  });

  it('does nothing when the entity is gone', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue(null);

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    expect(cache.modify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeItemFromShoppingListForMoveToPantry
// ---------------------------------------------------------------------------

describe('removeItemFromShoppingListForMoveToPantry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when parent entity is not found', () => {
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    removeItemFromShoppingListForMoveToPantry(
      cache,
      'sl-missing',
      'sli-1',
      true,
    );

    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('removes edge and decrements totalCount on purchased variant when wasPurchased=true', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
        if (ref?.__ref === 'ShoppingListItem:sli-2') return 'sli-2';
      }
      return undefined;
    });

    const existing = {
      edges: [
        { node: { __ref: 'ShoppingListItem:sli-1' } },
        { node: { __ref: 'ShoppingListItem:sli-2' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('does NOT modify unpurchased variant when wasPurchased=true', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-3' } }],
      totalCount: 3,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('removes edge and decrements totalCount on unpurchased variant when wasPurchased=false', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
      }
      return undefined;
    });

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('does NOT modify purchased variant when wasPurchased=false', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-2' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  /**
   * The counters moved OUT of this suite.
   *
   * They live in a second `cache.modify` that only runs when the edge was
   * actually removed — this helper is called twice for one online move, and
   * `edges.filter` is idempotent while `-1` is not. `createMockCache().modify`
   * is a `jest.fn` that never invokes a modifier, so nothing here can make that
   * condition true, and a counter assertion in this suite could only ever
   * answer "does the modifier subtract?", which was never in doubt. That is how
   * the double-decrement shipped under a green suite.
   *
   * `moveToPantryCounters.test.ts` covers them against the real cache, where
   * the two passes and their cumulative result are observable.
   */

  it('evicts item entity and calls gc', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:sli-1',
    });
    expect(cache.gc).toHaveBeenCalledTimes(1);
  });

  it('does not throw when cache.modify throws', () => {
    const cache = createMockCache();
    cache.modify.mockImplementation(() => {
      throw new Error('cache error');
    });

    expect(() =>
      removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true),
    ).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to remove item from ShoppingList for move to pantry',
      ),
      expect.any(Error),
    );
  });
});
