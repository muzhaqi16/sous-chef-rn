import { makeCache } from '../cache';

/**
 * The cache key format is not cosmetic: `queueManager.findCachedTypename`
 * resolves an entity's type by finding the key that ends in `:<entityId>`, and
 * that is how a permanently-failed queued mutation locates the entity to evict
 * and the optimistic fields to clear.
 *
 * Declaring `keyFields: ['id']` — Apollo's own default, spelled out — switches
 * the key to `Type:{"id":"abc"}`, which ends in no such suffix. Twenty-seven
 * types did that, so the lookup returned null for all of them and the cleanup
 * silently did nothing.
 */
describe('normalized cache key format', () => {
  const TYPES = [
    'ShoppingListItem',
    'PantryItem',
    'PantryItemBatch',
    'Unit',
    'StorageLocation',
    'Notification',
    'Category',
    'Brand',
    'Membership',
    'HomeInvite',
    'ShoppingListCollaborator',
    'Purchase',
    'Store',
    'SavedRecipe',
    'NotificationPreferences',
    'DietaryProfile',
    'UserProfile',
    'UserSettings',
    'RecipeIngredient',
    'Item',
    'Recipe',
    'MealPlan',
    'MealPlanItem',
    'User',
  ];

  it.each(TYPES)('%s keys as Type:id', typename => {
    const cache = makeCache();
    expect(cache.identify({ __typename: typename, id: 'abc123' })).toBe(
      `${typename}:abc123`,
    );
  });

  it('produces keys the queue can resolve a typename from', () => {
    const cache = makeCache();
    const entityId = 'clid_abc123';
    const key = cache.identify({ __typename: 'PantryItem', id: entityId });

    // Exactly what findCachedTypename does.
    expect(key?.endsWith(`:${entityId}`)).toBe(true);
    expect(key?.slice(0, key.length - `:${entityId}`.length)).toBe(
      'PantryItem',
    );
  });

  it('would have failed under the explicit-keyFields format', () => {
    // Guards the reasoning above rather than the code: if a future Apollo made
    // both forms identical, this test says so instead of quietly passing.
    const { InMemoryCache } = jest.requireActual('@apollo/client');
    const explicit = new InMemoryCache({
      typePolicies: { PantryItem: { keyFields: ['id'] } },
    });
    const key = explicit.identify({ __typename: 'PantryItem', id: 'abc123' });
    expect(key).toBe('PantryItem:{"id":"abc123"}');
    expect(key?.endsWith(':abc123')).toBe(false);
  });
});
