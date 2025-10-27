import { useEffect } from 'react';
import { client } from '#/apollo/client';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { useAuth } from '#/hooks/auth/useAuth';

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
  enabled = true
) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !enabled) return;

    // Load all optimistic updates for this entity type
    const allUpdates = optimisticDataPersistence.getAllForType(entityType);

    if (allUpdates.size === 0) {
      // No persisted data to restore
      return;
    }

    console.log(
      `📦 Restoring ${allUpdates.size} ${entityType} entities with optimistic updates`,
    );

    // Apply all updates to Apollo cache using cache.batch() for better performance
    // This broadcasts changes once instead of after each modify
    let totalFieldsRestored = 0;

    client.cache.batch({
      update: (cache) => {
        allUpdates.forEach((fields, entityId) => {
          const fieldCount = Object.keys(fields).length;
          totalFieldsRestored += fieldCount;

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
      }
    });

    console.log(
      `✓ Restored ${totalFieldsRestored} optimistic fields across ${allUpdates.size} ${entityType} entities`,
    );
  }, [user?.id, entityType, enabled]);
}

/**
 * Hook to restore optimistic data for multiple entity types
 *
 * Convenience wrapper for restoring multiple types at once.
 *
 * @param entityTypes - Array of GraphQL typenames
 * @param enabled - Whether restoration is enabled (default: true)
 *
 * @example
 * ```typescript
 * // Restore both lists and items in one call
 * useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']);
 * ```
 */
export function useOptimisticDataRestorationMultiple(
  entityTypes: string[],
  enabled = true
) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !enabled || entityTypes.length === 0) return;

    console.log(`📦 Restoring optimistic data for ${entityTypes.length} entity types`);

    let totalEntities = 0;
    let totalFields = 0;

    // Batch all cache modifications for better performance
    client.cache.batch({
      update: (cache) => {
        // Process all entity types
        entityTypes.forEach(entityType => {
          const allUpdates = optimisticDataPersistence.getAllForType(entityType);

          if (allUpdates.size === 0) return;

          totalEntities += allUpdates.size;

          // Apply updates to cache
          allUpdates.forEach((fields, entityId) => {
            totalFields += Object.keys(fields).length;

            const fieldUpdates = Object.keys(fields).reduce((acc, field) => {
              acc[field] = () => fields[field];
              return acc;
            }, {} as Record<string, () => any>);

            cache.modify({
              id: cache.identify({
                __typename: entityType,
                id: entityId,
              }),
              fields: fieldUpdates,
            });
          });
        });
      }
    });

    if (totalFields > 0) {
      console.log(
        `✓ Restored ${totalFields} fields across ${totalEntities} entities of ${entityTypes.length} types`,
      );
    }
  }, [user?.id, entityTypes, enabled]);
}
