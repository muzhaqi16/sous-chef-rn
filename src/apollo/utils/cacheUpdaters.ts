import type { ApolloCache, Reference } from '@apollo/client';
import { InMemoryCache } from '@apollo/client';
import { serializeError } from '#/utils/errorSerialization';

/**
 * Apollo Cache Update Utilities
 *
 * Generic, reusable functions for common cache operations.
 * Eliminates duplicate cache.modify() implementations across the codebase.
 *
 * @module apollo/utils/cacheUpdaters
 */

// =============================================================================
// Helpers
// =============================================================================

/**
 * Run garbage collection with `resetResultCache` so stale query results
 * referencing evicted entities are discarded immediately.
 *
 * `ApolloCache.gc()` doesn't expose the `resetResultCache` option in its
 * abstract type signature, but `InMemoryCache` (the runtime type) does.
 * We use `instanceof` to narrow safely.
 */
export function gcResetResultCache(cache: ApolloCache): string[] {
  if (cache instanceof InMemoryCache) {
    return cache.gc({ resetResultCache: true });
  }
  return cache.gc();
}

// =============================================================================
// Types
// =============================================================================

/**
 * Shape of a Connection field value in cache.modify() callbacks.
 * Apollo wraps field values as `Reference | AsStoreObject<T>`, so
 * the optional `__ref` makes this structurally compatible with `Reference`.
 */
export type ConnectionData = {
  edges?: ReadonlyArray<{ node: Reference }>;
  totalCount?: number;
  readonly __ref?: string;
};

/**
 * Position where new items should be added in arrays/connections
 */
export type InsertPosition = 'start' | 'end';

/**
 * Options for adding items to cache arrays
 */
export interface AddToArrayOptions {
  /** Position to insert the item (default: 'start') */
  position?: InsertPosition;
  /** Whether to check for duplicates before adding (default: true) */
  checkDuplicates?: boolean;
}

/**
 * Options for adding items to Connection fields
 */
export interface AddToConnectionOptions extends AddToArrayOptions {
  /** Update totalCount field (default: true) */
  updateTotalCount?: boolean;
}

/**
 * Options for removing items from arrays/connections
 */
export interface RemoveFromArrayOptions {
  /** Whether to evict the item from cache entirely (default: false) */
  evictItem?: boolean;
  /** Whether to run garbage collection after eviction (default: true).
   *  Set to false in multi-delete operations and call cache.gc() once at the end. */
  gc?: boolean;
}

// =============================================================================
// Query Root Field Updaters (for flat arrays)
// =============================================================================

/**
 * Creates a function to add items to a Query root field (flat array)
 *
 * Use this for Query fields that return arrays directly (not Connection):
 * - Query.homes
 * - Query.storageLocations
 *
 * @example
 * const addToHomes = createAddToQueryFieldUpdater('homes');
 * addToHomes(cache, newHome);
 *
 * @param fieldName - Query field name (e.g., 'homes', 'storageLocations')
 * @returns Function to add items to the field
 */
export function createAddToQueryFieldUpdater<T extends { id: string }>(
  fieldName: string,
) {
  return (
    cache: ApolloCache,
    newItem: T,
    options: AddToArrayOptions = {},
  ): void => {
    const { position = 'start', checkDuplicates = true } = options;

    try {
      cache.modify({
        fields: {
          [fieldName](
            existingItems: readonly Reference[] = [],
            { toReference, readField },
          ) {
            const newItemRef = toReference(newItem, true);

            if (!newItemRef) return existingItems;

            // Check for duplicates if enabled
            if (checkDuplicates) {
              const exists = existingItems.some(
                itemRef => readField('id', itemRef) === newItem.id,
              );

              if (exists) return existingItems;
            }

            // Add at specified position
            return position === 'start'
              ? [newItemRef, ...existingItems]
              : [...existingItems, newItemRef];
          },
        },
      });
    } catch (error) {
      console.warn(`Cache update failed for adding to ${fieldName}:`, error);
      // Fail silently - caller can handle refetch if needed
    }
  };
}

/**
 * Creates a function to add items to a Query root Connection field
 *
 * Use this for Query fields that return Connection objects (with edges/pageInfo):
 * - Query.shoppingLists (ShoppingListConnection)
 * - Query.recipes (RecipeConnection)
 *
 * Unlike createAddToQueryFieldUpdater which expects flat arrays,
 * this handles the Connection pattern with edges.
 *
 * @example
 * const addToShoppingLists = createAddToQueryConnectionUpdater('shoppingLists', 'ShoppingList');
 * addToShoppingLists(cache, newList);
 *
 * @param fieldName - Query field name (e.g., 'shoppingLists')
 * @param itemTypename - GraphQL typename for edge creation (e.g., 'ShoppingList')
 * @returns Function to add items to the Connection field
 */
export function createAddToQueryConnectionUpdater<T extends { id: string }>(
  fieldName: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    newItem: T,
    options: AddToConnectionOptions = {},
  ): void => {
    const {
      position = 'start',
      checkDuplicates = true,
      updateTotalCount = true,
    } = options;

    try {
      cache.modify({
        fields: {
          [fieldName](
            existingConnection: ConnectionData = {},
            { toReference, readField },
          ) {
            const newItemRef = toReference(newItem, true);
            if (!newItemRef) return existingConnection;

            const existingEdges = existingConnection?.edges || [];

            // Check for duplicates if enabled
            if (checkDuplicates) {
              const exists = existingEdges.some(
                edge => readField('id', edge?.node) === newItem.id,
              );
              if (exists) return existingConnection;
            }

            // Create new edge
            const newEdge = {
              __typename: `${itemTypename}Edge`,
              node: newItemRef,
              cursor: '', // Will be populated on next fetch
            };

            // Add edge at specified position
            const edges =
              position === 'start'
                ? [newEdge, ...existingEdges]
                : [...existingEdges, newEdge];

            // Update totalCount if enabled
            const totalCount = updateTotalCount
              ? (existingConnection?.totalCount || 0) + 1
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });
    } catch (error) {
      console.warn(`Cache update failed for adding to ${fieldName}:`, error);
    }
  };
}

/**
 * Creates a function to remove items from a Query root Connection field
 *
 * Use this for Query fields that return Connection objects (with edges/pageInfo):
 * - Query.recipes (RecipeConnection)
 *
 * Unlike createRemoveFromQueryFieldUpdater which expects flat arrays,
 * this handles the Connection pattern with edges.
 *
 * @example
 * const removeFromRecipes = createRemoveFromQueryConnectionUpdater('recipes', 'Recipe');
 * removeFromRecipes(cache, deletedRecipeId, { evictItem: true });
 *
 * @param fieldName - Query field name (e.g., 'recipes')
 * @param typename - GraphQL typename for eviction (e.g., 'Recipe')
 * @returns Function to remove items from the Connection field
 */
export function createRemoveFromQueryConnectionUpdater(
  fieldName: string,
  typename: string,
) {
  return (
    cache: ApolloCache,
    itemId: string,
    options: RemoveFromArrayOptions & { updateTotalCount?: boolean } = {},
  ): void => {
    const { evictItem = false, gc = true, updateTotalCount = true } = options;

    try {
      cache.modify({
        fields: {
          [fieldName](existingConnection: ConnectionData = {}, { readField }) {
            const existingEdges = existingConnection?.edges || [];

            const edges = existingEdges.filter(
              edge => readField('id', edge?.node) !== itemId,
            );

            const totalCount = updateTotalCount
              ? Math.max(0, (existingConnection?.totalCount || 0) - 1)
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });

      // Optionally evict the item itself from cache
      if (evictItem) {
        cache.evict({
          id: cache.identify({ __typename: typename, id: itemId }),
        });
        if (gc) {
          gcResetResultCache(cache);
        }
      }
    } catch (error) {
      console.warn(
        `Cache update failed for removing from ${fieldName}:`,
        error,
      );
    }
  };
}

// =============================================================================
// Parent Entity Field Updaters (for nested arrays/connections)
// =============================================================================

/**
 * Creates a function to add items to a parent entity's Connection field
 *
 * Use this for Connection fields nested in entities:
 * - Pantry.itemsConnection
 * - ShoppingList.itemsConnection
 * - Home.membersConnection
 * - Home.invitesConnection
 *
 * @example
 * const addToPantryItems = createAddToParentConnectionUpdater('Pantry', 'itemsConnection', 'PantryItem');
 * addToPantryItems(cache, pantryId, newItem);
 *
 * @param parentTypename - Parent entity typename (e.g., 'Pantry', 'ShoppingList')
 * @param connectionField - Connection field name (e.g., 'itemsConnection')
 * @param itemTypename - Item typename for edge creation (e.g., 'PantryItem')
 * @returns Function to add items to the connection
 */
export function createAddToParentConnectionUpdater<T extends { id: string }>(
  parentTypename: string,
  connectionField: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    newItem: T,
    options: AddToConnectionOptions = {},
  ): void => {
    const {
      position = 'start',
      checkDuplicates = true,
      updateTotalCount = true,
    } = options;

    try {
      // Get parent entity's cache ID
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        console.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return;
      }

      cache.modify({
        id: parentCacheId,
        fields: {
          [connectionField](
            existingConnection: ConnectionData = {},
            { readField, toReference },
          ) {
            const newItemRef = toReference(newItem, true);

            if (!newItemRef) return existingConnection;

            const existingEdges = existingConnection?.edges || [];

            // Note: We intentionally don't filter edges with temporarily unresolved nodeIds
            // as this can cause valid items to be incorrectly removed during rapid cache operations

            // Check for duplicates if enabled
            if (checkDuplicates) {
              const exists = existingEdges.some(
                edge => readField('id', edge?.node) === newItem.id,
              );

              if (exists) {
                return existingConnection;
              }
            }

            // Create new edge
            const newEdge = {
              __typename: `${itemTypename}Edge`,
              node: newItemRef,
              cursor: '', // Will be populated on next fetch
            };

            // Add edge at specified position
            const edges =
              position === 'start'
                ? [newEdge, ...existingEdges]
                : [...existingEdges, newEdge];

            // Update totalCount if enabled
            const totalCount = updateTotalCount
              ? (existingConnection?.totalCount || 0) + 1
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });
    } catch (error) {
      console.warn(
        `Cache update failed for adding to ${parentTypename}.${connectionField}:`,
        error,
      );
    }
  };
}

/**
 * Creates a function to add items to a parent entity's flat array field
 *
 * Use this for non-Connection array fields nested in entities.
 *
 * @example
 * const addToPantryItems = createAddToParentArrayUpdater('Pantry', 'items');
 * addToPantryItems(cache, pantryId, newItem);
 *
 * @param parentTypename - Parent entity typename
 * @param arrayField - Array field name
 * @returns Function to add items to the array
 */
export function createAddToParentArrayUpdater<T extends { id: string }>(
  parentTypename: string,
  arrayField: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    newItem: T,
    options: AddToArrayOptions = {},
  ): void => {
    const { position = 'start', checkDuplicates = true } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        console.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return;
      }

      cache.modify({
        id: parentCacheId,
        fields: {
          [arrayField](
            existingItems: readonly Reference[] = [],
            { toReference, readField },
          ) {
            const newItemRef = toReference(newItem, true);

            if (!newItemRef) return existingItems;

            // Check for duplicates if enabled
            if (checkDuplicates) {
              const exists = existingItems.some(
                itemRef => readField('id', itemRef) === newItem.id,
              );

              if (exists) return existingItems;
            }

            // Add at specified position
            return position === 'start'
              ? [newItemRef, ...existingItems]
              : [...existingItems, newItemRef];
          },
        },
      });
    } catch (error) {
      console.warn(
        `Cache update failed for adding to ${parentTypename}.${arrayField}:`,
        error,
      );
    }
  };
}

/**
 * Creates a function to remove items from a parent entity's Connection field
 *
 * Removes the item from the edges array and optionally evicts from cache.
 *
 * @example
 * const removeFromPantryItems = createRemoveFromParentConnectionUpdater(
 *   'Pantry',
 *   'itemsConnection',
 *   'PantryItem'
 * );
 * removeFromPantryItems(cache, pantryId, itemId, { evictItem: true });
 *
 * @param parentTypename - Parent entity typename
 * @param connectionField - Connection field name
 * @param itemTypename - Item typename for eviction
 * @returns Function to remove items from the connection
 */
export function createRemoveFromParentConnectionUpdater(
  parentTypename: string,
  connectionField: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    itemId: string,
    options: RemoveFromArrayOptions & { updateTotalCount?: boolean } = {},
  ): void => {
    const { evictItem = false, gc = true, updateTotalCount = true } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        console.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return;
      }

      // Remove from connection edges
      cache.modify({
        id: parentCacheId,
        fields: {
          [connectionField](
            existingConnection: ConnectionData = {},
            { readField },
          ) {
            const existingEdges = existingConnection?.edges || [];

            // Filter out only the specific item being removed
            // Note: We intentionally don't filter edges with temporarily unresolved nodeIds
            // as this can cause valid items to be incorrectly removed during rapid cache operations
            const edges = existingEdges.filter(edge => {
              const nodeId = readField('id', edge?.node);
              return nodeId !== itemId;
            });

            // Update totalCount if enabled
            const totalCount = updateTotalCount
              ? Math.max(0, (existingConnection?.totalCount || 0) - 1)
              : existingConnection?.totalCount;

            return {
              ...existingConnection,
              edges,
              ...(updateTotalCount && { totalCount }),
            };
          },
        },
      });

      // Optionally evict the item itself from cache
      if (evictItem) {
        cache.evict({
          id: cache.identify({ __typename: itemTypename, id: itemId }),
        });
        if (gc) {
          gcResetResultCache(cache);
        }
      }
    } catch (error) {
      console.warn(
        `Cache update failed for removing from ${parentTypename}.${connectionField}:`,
        error,
      );
    }
  };
}

/**
 * Creates a function to remove items from a parent entity's flat array field
 *
 * @example
 * const removeFromPantryItems = createRemoveFromParentArrayUpdater('Pantry', 'items', 'PantryItem');
 * removeFromPantryItems(cache, pantryId, itemId, { evictItem: true });
 *
 * @param parentTypename - Parent entity typename
 * @param arrayField - Array field name
 * @param itemTypename - Item typename for eviction
 * @returns Function to remove items from the array
 */
export function createRemoveFromParentArrayUpdater(
  parentTypename: string,
  arrayField: string,
  itemTypename: string,
) {
  return (
    cache: ApolloCache,
    parentId: string,
    itemId: string,
    options: RemoveFromArrayOptions = {},
  ): void => {
    const { evictItem = false, gc = true } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        console.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return;
      }

      cache.modify({
        id: parentCacheId,
        fields: {
          [arrayField](
            existingItems: readonly Reference[] = [],
            { readField },
          ) {
            return existingItems.filter(
              itemRef => readField('id', itemRef) !== itemId,
            );
          },
        },
      });

      // Optionally evict the item itself from cache
      if (evictItem) {
        cache.evict({
          id: cache.identify({ __typename: itemTypename, id: itemId }),
        });
        if (gc) {
          gcResetResultCache(cache);
        }
      }
    } catch (error) {
      console.warn(
        `Cache update failed for removing from ${parentTypename}.${arrayField}:`,
        error,
      );
    }
  };
}

// =============================================================================
// Entity Field Updaters
// =============================================================================

/**
 * Set one or more fields on a cached entity to specific values.
 *
 * Wraps the identify → modify → error-handling boilerplate.
 * Use for simple field replacements (quantity, role, timestamps).
 *
 * @example
 * setCachedFields(cache, 'ShoppingListItem', itemId, { quantity: 5 });
 * setCachedFields(cache, 'Membership', id, { role: 'ADMIN', updatedAt: new Date().toISOString() });
 */
export function setCachedFields(
  cache: ApolloCache,
  typename: string,
  entityId: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    const cacheId = cache.identify({ __typename: typename, id: entityId });
    if (!cacheId) return;

    const fields: Record<
      string,
      () => string | number | boolean | null | undefined
    > = {};
    for (const [key, value] of Object.entries(fieldValues)) {
      fields[key] = () => value;
    }

    cache.modify({ id: cacheId, fields });
  } catch (error) {
    console.warn(`Cache update failed for ${typename}:${entityId}:`, error);
  }
}

/**
 * Increment or decrement a numeric counter inside a nested object field.
 *
 * Spreads the existing object and updates the specified counter key.
 * Clamps to a minimum of 0 to prevent negative counts.
 *
 * @example
 * incrementNestedCounter(cache, 'Pantry', pantryId, 'stats', 'totalItems', 1);
 * incrementNestedCounter(cache, 'Pantry', pantryId, 'stats', 'totalItems', -1);
 */
export function incrementNestedCounter(
  cache: ApolloCache,
  typename: string,
  entityId: string,
  objectField: string,
  counterKey: string,
  delta: number,
): void {
  try {
    const cacheId = cache.identify({ __typename: typename, id: entityId });
    if (!cacheId) return;
    const fieldModifier = (existingValue: Record<string, number>) => {
      if (!existingValue) return existingValue;
      return {
        ...existingValue,
        [counterKey]: Math.max(0, (existingValue[counterKey] || 0) + delta),
      };
    };

    // @ts-expect-error Apollo's Modifier wraps values with Reference (interface without
    // index signature), but nested object fields are never References at runtime
    cache.modify({ id: cacheId, fields: { [objectField]: fieldModifier } });
  } catch (error) {
    console.warn(
      `Cache update failed for ${typename}:${entityId}.${objectField}.${counterKey}:`,
      error,
    );
  }
}

// =============================================================================
// Direct Item Eviction
// =============================================================================

/**
 * Creates a function to evict an item from cache entirely
 *
 * Use this when you need to remove an item without modifying any arrays/connections.
 * The item will be removed from all queries that reference it.
 *
 * @example
 * const evictPantryItem = createItemEvictor('PantryItem');
 * evictPantryItem(cache, itemId);
 *
 * @param typename - GraphQL typename
 * @returns Function to evict items
 */
export function createItemEvictor(typename: string) {
  return (cache: ApolloCache, itemId: string): void => {
    safeEvict(cache, typename, itemId);
  };
}

/**
 * Safely evict a single entity from cache and run garbage collection.
 *
 * Centralizes the identify → evict → gc(resetResultCache) pattern.
 * Use this instead of calling cache.evict() + cache.gc() directly.
 *
 * @example
 * safeEvict(cache, 'ShoppingListItem', itemId);
 */
export function safeEvict(
  cache: ApolloCache,
  typename: string,
  itemId: string,
): void {
  try {
    cache.evict({
      id: cache.identify({ __typename: typename, id: itemId }),
    });
    gcResetResultCache(cache);
  } catch (error) {
    console.warn(
      `Cache eviction failed for ${typename}:${itemId}:`,
      serializeError(error),
    );
  }
}

/**
 * Safely evict multiple entities from cache, running GC once at the end.
 *
 * More efficient than calling safeEvict() in a loop (single GC pass).
 *
 * @example
 * safeEvictMany(cache, [
 *   { typename: 'ShoppingListItem', id: 'item-1' },
 *   { typename: 'ShoppingListItem', id: 'item-2' },
 * ]);
 */
export function safeEvictMany(
  cache: ApolloCache,
  items: ReadonlyArray<{ typename: string; id: string }>,
): void {
  try {
    for (const { typename, id } of items) {
      const cacheId = cache.identify({ __typename: typename, id });
      if (cacheId) {
        cache.evict({ id: cacheId });
      }
    }
    gcResetResultCache(cache);
  } catch (error) {
    console.warn('Batch cache eviction failed:', serializeError(error));
  }
}
