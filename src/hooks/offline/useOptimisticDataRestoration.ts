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
 * Generic hook to restore optimistic data on app launch
 *
 * Works for any entity type - automatically restores all persisted field updates
 * for entities of the specified type. This is the foundation for offline-first
 * features across the entire app.
 *
 * @param entityType - GraphQL typename (e.g., 'ShoppingListItem', 'ShoppingList', 'PantryItem')
 * @param enabled - Whether restoration is enabled (default: true)
 *
 * @example
 * ```typescript
 * // In any component that needs offline persistence
 * function ShoppingListMain() {
 *   useOptimisticDataRestoration('ShoppingListItem'); // Restores items
 *   useOptimisticDataRestoration('ShoppingList');     // Restores lists
 *
 *   // ... rest of component
 * }
 * ```
 *
 * How it works:
 * 1. On mount, checks if user has persisted optimistic data
 * 2. Loads all updates for the specified entity type
 * 3. Applies them to Apollo cache via cache.modify
 * 4. Updates are cleared when mutations successfully sync (via onCompleted)
 */
export function useOptimisticDataRestoration(
  entityType: string,
  enabled = true,
) {
  const user = useUser();

  useEffect(() => {
    if (!user?.id || !enabled) return;

    // Defer restoration to avoid blocking navigation/initial render
    // Using startTransition marks this as non-urgent work
    startTransition(() => {
      // Load all optimistic updates for this entity type
      const allUpdates = optimisticDataPersistence.getAllForType(entityType);

      if (allUpdates.size === 0) {
        // No persisted data to restore
        return;
      }

      // Apply all updates to Apollo cache using cache.batch() for better performance
      // This broadcasts changes once instead of after each modify
      client.cache.batch({
        update: cache => {
          allUpdates.forEach((fields, entityId) => {
            // Build field update functions
            const fieldUpdates = Object.keys(fields).reduce((acc, field) => {
              acc[field] = () => fields[field];
              return acc;
            }, {} as Record<string, () => any>);

            // Apply to cache
            cache.modify({
              id: cache.identify({
                __typename: entityType,
                id: entityId,
              }),
              fields: fieldUpdates,
            });
          });
        },
      });
    });
  }, [user?.id, entityType, enabled]);
}

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
                const cached = cache.readFragment({
                  id: cacheId,
                  fragment: VERSION_FRAGMENT,
                });
                const currentVersion = (cached as any)?.version as
                  | number
                  | undefined;

                // If cache has newer or equal version, skip restoration
                if (
                  currentVersion !== undefined &&
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
              }, {} as Record<string, () => any>);

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
