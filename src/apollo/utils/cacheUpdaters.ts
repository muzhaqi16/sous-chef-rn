import type { ApolloCache, Reference } from '@apollo/client';
import { InMemoryCache } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
// The GraphQLCodegenDataMasking variant matches what the project's HKT
// registration (src/types/apollo-masking.d.ts) makes read/writeFragment use.
import type { GraphQLCodegenDataMasking } from '@apollo/client/masking';

type Unmasked<TData> = GraphQLCodegenDataMasking.Unmasked<TData>;
import { serializeError } from '#/utils/errorSerialization';
import { logger } from '#/utils/environment';

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
  /**
   * Leave a cached variant untouched, matched on its `storeFieldName` (e.g.
   * `shoppingLists({"filters":{"isTemplate":true}})`). A `cache.modify` write
   * fans out across every `keyArgs` variant of the field, so this is how a
   * filtered variant the new item doesn't belong to opts out.
   */
  skipStoreField?: (storeFieldName: string) => boolean;
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
// Query Root Connection Updaters
// =============================================================================

/**
 * Build a `skipStoreField` guard for a connection keyed on a `filters` argument.
 *
 * A `cache.modify` runs its modifier against every cached variant of the field,
 * so writing a new entity fans it out into filtered views it does not belong to
 * — a DINNER template lands in the BREAKFAST list and in whatever search results
 * happen to be cached.
 *
 * The unfiltered variant always takes the write. A filtered one takes it only
 * when every active filter is a key in `equals` and matches. Anything else — a
 * search string, a tag set, a duration range — skips: replicating the server's
 * matching here is how a cache write starts disagreeing with the next read, and
 * a briefly-missing row heals on that read while a wrongly-placed one does not.
 *
 * @example
 * addToMealTemplates(cache, template, {
 *   skipStoreField: skipUnmatchedFilterVariants({ category: template.category }),
 * });
 */
export function skipUnmatchedFilterVariants(
  equals: Record<string, unknown>,
): (storeFieldName: string) => boolean {
  return storeFieldName => {
    const argsStart = storeFieldName.indexOf('(');
    if (argsStart === -1) return false;

    const args = storeFieldName.slice(argsStart + 1, -1);
    if (!args) return false;

    let parsed: unknown;
    try {
      parsed = JSON.parse(args);
    } catch {
      // Unparseable args mean we cannot prove the variant matches, and the
      // safe direction is to leave it for the next read.
      return true;
    }

    const filters = (parsed as { filters?: unknown } | null)?.filters;
    if (!filters || typeof filters !== 'object') return false;

    return Object.entries(filters).some(([key, value]) => {
      const isActive =
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0);
      if (!isActive) return false;
      return !(key in equals) || equals[key] !== value;
    });
  };
}

/**
 * Creates a function to add items to a Query root Connection field
 *
 * Use this for Query fields that return Connection objects (with edges/pageInfo):
 * - Query.shoppingLists (ShoppingListConnection)
 * - Query.recipes (RecipeConnection)
 *
 * Handles the Connection pattern with edges (not flat arrays).
 *
 * **keyArgs gotcha:** `cache.modify` fires the field modifier for *every*
 * cached variant of `fieldName` (one per `keyArgs` combination). On a
 * connection with `keyArgs: ['category', 'difficulty']`, the new item lands
 * in every cached filter view — even ones whose filter shouldn't include
 * it. If membership depends on filters/orderBy, prefer a targeted refetch
 * over this helper.
 *
 * **Edge typename:** assumes Relay convention (`Foo` → `FooEdge`). The
 * codegen schema follows this today; a non-Relay edge typename will
 * produce wrong values silently.
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
  ): boolean => {
    const {
      position = 'start',
      checkDuplicates = true,
      updateTotalCount = true,
      skipStoreField,
    } = options;

    try {
      return cache.modify({
        fields: {
          [fieldName](
            existingConnection: ConnectionData = {},
            { toReference, readField, storeFieldName },
          ) {
            if (skipStoreField?.(storeFieldName)) return existingConnection;

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
      logger.warn(
        `Cache update failed for adding to ${fieldName}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Creates a function to remove items from a Query root Connection field.
 *
 * Mirrors {@link createRemoveFromParentConnectionUpdater}'s two-mode design:
 *
 * - `evictItem: true` (the common "delete entity" path): just evicts the
 *   entity and runs gc. The connection's `read` field policy filters the
 *   now-dangling edge and decrements `totalCount` on next read.
 *
 * - `evictItem: false` (the rare "remove from this connection only" path):
 *   the entity stays in cache, so we manually filter the edge and decrement
 *   `totalCount` here.
 *
 * Use this for Query fields that return Connection objects (with edges/pageInfo):
 * - Query.recipes (RecipeConnection)
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
      if (evictItem) {
        const cacheId = cache.identify({ __typename: typename, id: itemId });
        if (!cacheId) return;
        cache.evict({ id: cacheId });
        if (gc) {
          gcResetResultCache(cache);
        }
        return;
      }

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
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${fieldName}:`,
        serializeError(error),
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
 * ⚠️ **Keyed connections:** when the field has `keyArgs` (e.g.
 * `Pantry.itemsConnection` keys on `['filters', 'orderBy']` in
 * `src/apollo/cache.ts`), `cache.modify` runs the modifier for **every**
 * cached `(filters, orderBy)` variant — the new edge is appended to every
 * filtered/sorted view, even ones whose filter would logically exclude the
 * item. `position` is also applied uniformly and ignores each variant's
 * `orderBy`. For filter-sensitive inserts, refetch the affected view or
 * target a single `storeFieldName` manually.
 *
 * **Edge typename:** assumes Relay convention (`Foo` → `FooEdge`). The
 * codegen schema follows this today; a non-Relay edge typename will
 * produce wrong values silently.
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
  ): boolean => {
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
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return false;
      }

      return cache.modify({
        id: parentCacheId,
        fields: {
          [connectionField](
            existingConnection: ConnectionData = {},
            { readField, toReference },
          ) {
            const newItemRef = toReference(newItem, true);

            if (!newItemRef) return existingConnection;

            const existingEdges = existingConnection?.edges || [];

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
      logger.warn(
        `Cache update failed for adding to ${parentTypename}.${connectionField}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Creates a function to add items to a parent entity's flat array field
 *
 * Use this for non-Connection array fields nested in entities.
 *
 * ⚠️ **Keyed fields:** when the field has `keyArgs`, `cache.modify` runs the
 * modifier for every cached variant — the new ref is inserted into every
 * variant, regardless of each variant's filter/sort. Same caveat as
 * {@link createAddToParentConnectionUpdater}.
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
  ): boolean => {
    const { position = 'start', checkDuplicates = true } = options;

    try {
      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return false;
      }

      return cache.modify({
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
      logger.warn(
        `Cache update failed for adding to ${parentTypename}.${arrayField}:`,
        serializeError(error),
      );
      return false;
    }
  };
}

/**
 * Creates a function to remove items from a parent entity's Connection field.
 *
 * Two modes:
 *
 * - `evictItem: true` (the common "delete entity" path): just evicts the
 *   entity and runs gc. The connection's `read` field policy
 *   (`itemsConnectionFieldPolicy` / `mergeConnectionByNodeId` in
 *   `src/apollo/cache.ts`) filters the now-dangling edge from `edges` and
 *   decrements `totalCount` on next read. This is Apollo's recommended
 *   `canRead`-based self-healing pattern for Relay connections.
 *
 * - `evictItem: false` (the rare "remove from this connection only" path):
 *   the entity stays in cache, so no edge becomes dangling — we manually
 *   filter the edge via `cache.modify` and decrement `totalCount` here.
 *   ⚠️ For keyed connections (e.g. `Pantry.itemsConnection` with `keyArgs:
 *   ['filters', 'orderBy']`), this filter+decrement runs for every cached
 *   variant. `evictItem: true` doesn't have this caveat because evicting
 *   the entity self-heals every variant via the field policy's `read`.
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
      if (evictItem) {
        const cacheId = cache.identify({
          __typename: itemTypename,
          id: itemId,
        });
        if (!cacheId) return;
        cache.evict({ id: cacheId });
        if (gc) {
          gcResetResultCache(cache);
        }
        return;
      }

      const parentCacheId = cache.identify({
        __typename: parentTypename,
        id: parentId,
      });

      if (!parentCacheId) {
        logger.warn(
          `Parent entity not found in cache: ${parentTypename}:${parentId}`,
        );
        return;
      }

      cache.modify({
        id: parentCacheId,
        fields: {
          [connectionField](
            existingConnection: ConnectionData = {},
            { readField },
          ) {
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
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${parentTypename}.${connectionField}:`,
        serializeError(error),
      );
    }
  };
}

/**
 * Creates a function to remove items from a parent entity's flat array field
 *
 * ⚠️ **Keyed fields:** when the array field has `keyArgs`, `cache.modify`
 * runs the filter for every cached variant. Same caveat as
 * {@link createRemoveFromParentConnectionUpdater}.
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
        logger.warn(
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
        const itemCacheId = cache.identify({
          __typename: itemTypename,
          id: itemId,
        });
        if (itemCacheId) {
          cache.evict({ id: itemCacheId });
          if (gc) {
            gcResetResultCache(cache);
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Cache update failed for removing from ${parentTypename}.${arrayField}:`,
        serializeError(error),
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
 * The value type is intentionally narrow (scalar | null | undefined). For
 * objects, arrays, or `Reference` writes — call `cache.modify` directly so
 * the field modifier can compose the new value from `existing` + helpers.
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
    logger.warn(
      `Cache update failed for ${typename}:${entityId}:`,
      serializeError(error),
    );
  }
}

/**
 * Snapshot a cached entity via its fragment, write `patch` over it PERMANENTLY
 * (a plain write, not Apollo's transient optimistic layer — it survives an
 * offline/queued mutation where no response ever arrives), and return a revert
 * that restores the snapshot.
 *
 * Contract for the fragment: it must select every field the patch writes plus
 * `updatedAt` (bumped on write so watchers re-render), and every field it
 * selects must be cached by the query that loads the entity — `readFragment`
 * returns null on ANY missing field, in which case both the write and the
 * revert silently no-op (the mutation response then becomes the only UI
 * update). The local-first list-settings hooks (complete / recurring / budget /
 * reminder / template) all share this shape.
 */
export function applyOptimisticFragmentPatch<TFragment>(
  cache: ApolloCache,
  entity: { typename: string; id: string },
  doc: {
    fragment: TypedDocumentNode<TFragment, unknown>;
    fragmentName: string;
  },
  patch: Partial<Unmasked<TFragment>>,
  label: string,
): () => void {
  const cacheId = cache.identify({
    __typename: entity.typename,
    id: entity.id,
  });
  // readFragment/writeFragment operate on Unmasked<TFragment> — that's
  // Apollo's own signature for the round trip, not a mask bypass; the snapshot
  // fragments here are flat (no nested spreads), so the shape is unchanged.
  const snapshot = cacheId
    ? cache.readFragment<TFragment>({
        id: cacheId,
        fragment: doc.fragment,
        fragmentName: doc.fragmentName,
      })
    : null;

  const write = (data: Unmasked<TFragment>, writeLabel: string) => {
    try {
      cache.writeFragment({
        id: cacheId,
        fragment: doc.fragment,
        fragmentName: doc.fragmentName,
        data,
      });
    } catch (error) {
      logger.warn(
        `Cache update failed for ${writeLabel}:`,
        serializeError(error),
      );
    }
  };

  if (snapshot) {
    write(
      { ...snapshot, ...patch, updatedAt: new Date().toISOString() },
      `${label} (optimistic)`,
    );
  }

  return () => {
    if (snapshot) {
      write(snapshot, `Revert ${label}`);
    }
  };
}

// =============================================================================
// Direct Item Eviction
// =============================================================================

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
    const cacheId = cache.identify({ __typename: typename, id: itemId });
    if (!cacheId) return;
    cache.evict({ id: cacheId });
    gcResetResultCache(cache);
  } catch (error) {
    logger.warn(
      `Cache eviction failed for ${typename}:${itemId}:`,
      serializeError(error),
    );
  }
}

/**
 * Reconcile a client-minted id with the server-assigned id after a create.
 *
 * When a mutation sends a client-minted PK (`input.id`) but the server resolves
 * the create to an *existing* row (already created elsewhere / catalog merge),
 * the returned id differs from the client cuid we wrote optimistically. Evict
 * the stale client-id entity so its now-dangling connection edge is dropped by
 * the self-healing read and the single server row stands — no duplicate rows,
 * no phantom entity.
 *
 * `clientId` MUST be read off the mutation's own `variables` at the call site
 * (never a shared ref) so this stays correct when creates overlap. A no-op when
 * the server echoed the same id (the honored-client-id path).
 *
 * @example
 * adoptServerEntityId(cache, 'SavedRecipe', savedRecipe.id, variables?.input?.id);
 */
export function adoptServerEntityId(
  cache: ApolloCache,
  typename: string,
  serverId: string,
  clientId: string | null | undefined,
): void {
  if (clientId && serverId !== clientId) {
    safeEvict(cache, typename, clientId);
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
    logger.warn('Batch cache eviction failed:', serializeError(error));
  }
}
