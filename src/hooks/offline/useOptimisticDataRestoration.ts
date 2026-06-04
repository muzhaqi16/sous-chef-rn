import { useEffect, startTransition } from 'react';
import { gql } from '@apollo/client';
import { client } from '#/apollo/client';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useUser } from '#store/useAppStore';

/** Minimal fragment for reading entity version from cache */
const VERSION_FRAGMENT = gql`
  fragment VersionCheck on Node {
    id
    version
  }
`;

/**
 * Hook to restore optimistic data for multiple entity types
 *
 * Convenience wrapper for restoring multiple types at once.
 * Handles array stability internally - consumers can pass inline arrays.
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

              // Version guard: Only restore if cache version < persisted version
              // This ensures API data (source of truth) is never overwritten by stale optimistic data
              if (cacheId && fields.version) {
                // Read the current version from cache using readFragment (avoids unnecessary cache broadcasts)
                const cached = cache.readFragment<{ version?: number }>({
                  id: cacheId,
                  fragment: VERSION_FRAGMENT,
                });
                const currentVersion = cached?.version;

                // If cache has newer or equal version, skip restoration
                if (
                  currentVersion !== undefined &&
                  typeof fields.version === 'number' &&
                  currentVersion >= fields.version
                ) {
                  // Cache has newer or equal version - skip restoration
                  // This means API data is more recent than our optimistic update
                  if (__DEV__) {
                    console.log(
                      `Skipping optimistic restoration for ${entityType}:${entityId} - cache version (${currentVersion}) >= persisted version (${fields.version})`,
                    );
                  }
                  return;
                }
              }

              const fieldUpdates = Object.keys(fields).reduce((acc, field) => {
                acc[field] = () => fields[field];
                return acc;
              }, {} as Record<string, () => unknown>);

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
