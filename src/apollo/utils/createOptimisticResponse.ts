/**
 * Utilities for creating optimistic responses with automatic version management
 *
 * These utilities help create optimistic responses that work seamlessly with
 * version-based conflict resolution in Apollo cache merge functions.
 */

/**
 * Base interface for entities that support versioned optimistic updates
 */
export interface VersionedEntity {
  id: string;
  version: number;
  updatedAt: string;
  __typename?: string;
}

/**
 * Enhances an entity with incremented version and updated timestamp
 *
 * Use this in optimistic responses to ensure the optimistic update
 * has a higher version than the current cached version.
 *
 * @template T - Entity type that extends VersionedEntity
 * @param currentItem - The current item from cache
 * @param updates - Partial updates to apply
 * @returns Enhanced item with incremented version and current timestamp
 *
 * @example
 * ```typescript
 * optimisticResponse: variables => {
 *   const currentItem = items.find(item => item.id === variables.id);
 *   return {
 *     __typename: 'Mutation',
 *     markItemPurchased: enhanceWithVersion(currentItem, {
 *       isPurchased: variables.status
 *     })
 *   };
 * }
 * ```
 */
export function enhanceWithVersion<T extends VersionedEntity>(
  currentItem: T | undefined,
  updates: Partial<T>,
): T {
  if (!currentItem) {
    // If no current item, return minimal optimistic response
    // Caller should handle this case
    throw new Error('enhanceWithVersion requires a current item from cache');
  }

  return {
    ...currentItem,
    ...updates,
    version: (currentItem.version || 0) + 1,
    updatedAt: new Date().toISOString(),
  } as T;
}

/**
 * Creates a minimal optimistic response for entities that don't exist in cache yet
 *
 * Useful for add/create mutations where the item doesn't exist yet.
 *
 * @template T - Entity type that extends VersionedEntity
 * @param typename - GraphQL typename (e.g., 'ShoppingListItem')
 * @param id - Entity ID (use 'temp-{uuid}' for new items)
 * @param data - Initial entity data
 * @returns Minimal entity with version 1 and current timestamp
 *
 * @example
 * ```typescript
 * optimisticResponse: variables => ({
 *   __typename: 'Mutation',
 *   addItemToShoppingList: createOptimisticEntity(
 *     'ShoppingListItem',
 *     `temp-${Date.now()}`,
 *     { itemName: variables.itemName, isPurchased: false }
 *   )
 * })
 * ```
 */
export function createOptimisticEntity<T extends VersionedEntity>(
  typename: string,
  id: string,
  data: Partial<Omit<T, 'id' | 'version' | 'updatedAt' | '__typename'>>,
): T {
  return {
    __typename: typename,
    id,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...data,
  } as T;
}

/**
 * Type guard to check if an entity has version and updatedAt fields
 *
 * @param entity - Entity to check
 * @returns True if entity has version and updatedAt fields
 */
export function isVersionedEntity(entity: any): entity is VersionedEntity {
  return (
    entity &&
    typeof entity === 'object' &&
    'id' in entity &&
    'version' in entity &&
    'updatedAt' in entity
  );
}
