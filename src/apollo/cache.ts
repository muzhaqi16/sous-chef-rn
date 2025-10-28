import { InMemoryCache } from '@apollo/client';

/**
 * Version-aware merge function that handles optimistic updates and conflict resolution
 *
 * Features:
 * - Preserves optimistic items (temp- IDs) until server confirms
 * - Resolves conflicts using version field (higher version wins)
 * - Falls back to updatedAt timestamp if versions are equal
 * - Works with any entity type that has id, version, and updatedAt
 *
 * @template T - Entity type with id, version, updatedAt fields
 */
function mergeArrayByIdIntelligent<T extends { id: string; __ref?: string }>(
  existing: T[] = [],
  incoming: T[] = [],
  { readField }: { readField: (field: string, ref: any) => any },
): T[] {
  // If no incoming data, always keep existing (preserves cache on network errors)
  if (!incoming || incoming.length === 0) {
    return existing || [];
  }

  // If no existing data, return incoming (first load or after cache clear)
  if (!existing || existing.length === 0) {
    return incoming;
  }

  // Create a map of existing items by ID with version metadata
  const existingMap = new Map<
    string,
    { item: T; version: number; updatedAt: string }
  >();
  existing.forEach(item => {
    const id = readField('id', item) as string;
    if (id) {
      existingMap.set(id, {
        item,
        version: (readField('version', item) as number) || 0,
        updatedAt: (readField('updatedAt', item) as string) || '',
      });
    }
  });

  // Create a map of incoming items by ID with version metadata
  const incomingMap = new Map<
    string,
    { item: T; version: number; updatedAt: string }
  >();
  incoming.forEach(item => {
    const id = readField('id', item) as string;
    if (id) {
      incomingMap.set(id, {
        item,
        version: (readField('version', item) as number) || 0,
        updatedAt: (readField('updatedAt', item) as string) || '',
      });
    }
  });

  // Merge with version-based conflict resolution
  const merged: T[] = [];

  // Process all incoming items
  incomingMap.forEach(
    (
      {
        item: incomingItem,
        version: incomingVersion,
        updatedAt: incomingUpdatedAt,
      },
      id,
    ) => {
      const existingData = existingMap.get(id);

      if (!existingData) {
        // New item from server, add it
        merged.push(incomingItem);
        return;
      }

      // Both exist - resolve conflict using version
      if (incomingVersion > existingData.version) {
        // Incoming has higher version, use it
        merged.push(incomingItem);
      } else if (incomingVersion < existingData.version) {
        // Existing has higher version (optimistic update ahead of server), keep existing
        merged.push(existingData.item);
      } else {
        // Same version - use timestamp as tiebreaker
        if (incomingUpdatedAt >= existingData.updatedAt) {
          merged.push(incomingItem);
        } else {
          merged.push(existingData.item);
        }
      }
    },
  );

  // Add any optimistic items not yet confirmed by server
  existingMap.forEach(({ item }, id) => {
    if (incomingMap.has(id)) {
      return; // Already processed above
    }

    // If item has temporary ID (optimistic), keep it until server confirms
    if (id.startsWith('temp-')) {
      merged.push(item);
    }
    // Otherwise, it was removed from server, don't include it
  });

  return merged;
}

/**
 * Apollo InMemoryCache with intelligent merge functions
 *
 * Uses version-based conflict resolution to properly handle:
 * - Mutation responses updating cached queries
 * - Optimistic updates
 * - Concurrent modifications
 */
export function makeCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // List-level queries (return collections of lists/homes)
          shoppingLists: {
            // No keyArgs needed - app doesn't use filters parameter
            // Simple merge with cache preservation on network errors
            merge(existing = [], incoming) {
              // Preserve existing cache if network request failed and returned empty
              // This prevents cache clearing when API is offline
              if (!incoming || incoming.length === 0) {
                return existing;
              }
              return incoming;
            },
          },
          pantries: {
            // Different homes have different pantries - cache separately
            keyArgs: ['homeId'],
            merge(existing = [], incoming) {
              // Preserve existing cache if network request failed and returned empty
              // This prevents cache clearing when API is offline
              if (!incoming || incoming.length === 0) {
                return existing;
              }
              return incoming;
            },
          },
          homes: {
            // No parameters - simple merge with existing data preservation
            merge(existing = [], incoming) {
              // If refetching and incoming is empty/null, preserve existing data
              // This prevents flickering when navigating back to the screen
              if (!incoming || incoming.length === 0) {
                return existing;
              }
              return incoming;
            },
          },
          storageLocations: {
            // Different homes have different storage locations - cache separately
            keyArgs: ['homeId'],
            merge(existing = [], incoming) {
              // Preserve existing cache if network request failed and returned empty
              // This prevents cache clearing when API is offline
              if (!incoming || incoming.length === 0) {
                return existing;
              }
              return incoming;
            },
          },
          storageLocationTree: {
            // Different homes have different storage location trees - cache separately
            keyArgs: ['homeId'],
            merge(existing = [], incoming) {
              // Preserve existing cache if network request failed and returned empty
              // This prevents cache clearing when API is offline
              if (!incoming || incoming.length === 0) {
                return existing;
              }
              return incoming;
            },
          },
          // Item-level queries (return items within a list/pantry)
          pantryItems: {
            keyArgs: ['pantryId'],
            // Intelligent merge to properly update cache when mutations return
            merge(existing, incoming, options) {
              const { readField } = options;

              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          shoppingListItems: {
            keyArgs: ['shoppingListId'],
            // Intelligent merge to properly update cache when mutations return
            merge(existing, incoming, { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
        },
      },
    },
  });
}
