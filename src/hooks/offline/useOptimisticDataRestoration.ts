import { useEffect, startTransition } from 'react';
import { client } from '#/apollo/client';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useUser } from '#store/useAppStore';

/**
 * Whether a persisted value is a partial patch of an object-valued field
 * rather than a whole replacement.
 *
 * A persisted field name has to be a field the entity actually has —
 * `cache.modify` silently ignores a modifier for a field that isn't there. Some
 * of what a mutation changes optimistically lives one level down
 * (`ShoppingListItem.purchaseInfo.isPurchased`), so the persisted entry names
 * the object field and carries only the keys it changed. Merging rather than
 * replacing keeps the rest of that object intact.
 *
 * Arrays are replacements, not patches — a persisted array is the new list.
 */
const isPartialObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Hook to restore optimistic data for multiple entity types
 *
 * Convenience wrapper for restoring multiple types at once.
 * Handles array stability internally - consumers can pass inline arrays.
 *
 * Every persisted entry is applied. There is deliberately no guard comparing
 * it against what the server last sent: an entry only exists while its mutation
 * is unconfirmed — every call site clears it on success AND on rejection — so
 * what survives a restart is exactly the local intent the offline queue is
 * about to replay. Preferring the server's value there would drop the edit the
 * person made and still expect to see.
 *
 * @param entityTypes - Array of GraphQL typenames
 * @param enabled - Whether restoration is enabled (default: true)
 *
 * @example
 * ```typescript
 * // Restore both lists and items in one call - inline array is fine
 * useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);
 * ```
 */
export function useOptimisticDataRestorationMultiple(
  entityTypes: string[],
  enabled = true,
) {
  const user = useUser();

  // Serialize array for stable dependency comparison
  // This allows consumers to pass inline arrays without causing infinite loops
  const stableEntityTypes = entityTypes;

  useEffect(() => {
    if (!user?.id || !enabled || stableEntityTypes.length === 0) return;

    // Defer restoration to avoid blocking navigation/initial render
    // Using startTransition marks this as non-urgent work that won't block the UI
    startTransition(() => {
      // Batch all cache modifications for better performance
      client.cache.batch({
        update: cache => {
          // Process all entity types
          stableEntityTypes.forEach(entityType => {
            const allUpdates =
              optimisticDataPersistence.getAllForType(entityType);

            if (allUpdates.size === 0) return;

            // Apply updates to cache
            allUpdates.forEach((fields, entityId) => {
              const cacheId = cache.identify({
                __typename: entityType,
                id: entityId,
              });

              // `cache.modify` with no id defaults to ROOT_QUERY, which would
              // write these fields onto the query root instead of the entity.
              if (!cacheId) return;

              const fieldUpdates = Object.keys(fields).reduce((acc, field) => {
                const value = fields[field];
                acc[field] = isPartialObject(value)
                  ? (existing: unknown) =>
                      isPartialObject(existing)
                        ? { ...existing, ...value }
                        : value
                  : () => value;
                return acc;
              }, {} as Record<string, (existing: unknown) => unknown>);

              cache.modify({
                id: cacheId,
                fields: fieldUpdates,
              });
            });
          });
        },
      });
    });
  }, [user?.id, stableEntityTypes, enabled]);
}
