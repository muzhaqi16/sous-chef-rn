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
 *
 * Cache Size Management:
 * - Monitors cache size and triggers garbage collection at 80% capacity
 * - Prevents unbounded cache growth through periodic cleanup
 * - Target maximum: ~100MB (approximately 100,000 typical entities)
 */
export function makeCache(): InMemoryCache {
  const cache = new InMemoryCache({
    typePolicies: {
      ShoppingListItem: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
      },
      ShoppingList: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
        fields: {
          items: {
            // Merge shopping list items intelligently to prevent cache data loss
            // Uses same version-based conflict resolution as Query.shoppingListItems
            merge(existing, incoming, { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          itemsConnection: {
            keyArgs: false,
            merge(existing, incoming, { args, readField }) {
              if (!incoming) return existing;
              if (!existing || !args?.itemsCursor) return incoming;

              // Pagination - merge edges with deduplication
              const existingEdges = existing.edges || [];
              const incomingEdges = incoming.edges || [];
              const edgeMap = new Map();

              [...existingEdges, ...incomingEdges].forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id && !edgeMap.has(id)) {
                  edgeMap.set(id, edge);
                }
              });

              return {
                ...incoming,
                edges: Array.from(edgeMap.values()),
              };
            },
          },
        },
      },
      Home: {
        keyFields: ['id'],
        fields: {
          membersConnection: {
            keyArgs: false,
            merge(existing, incoming, { args, readField }) {
              if (!incoming) return existing;
              if (!existing || !args?.membersCursor) return incoming;

              // Deduplicate by node ID
              const edgeMap = new Map();
              [...(existing.edges || []), ...(incoming.edges || [])].forEach(
                (edge: any) => {
                  const id = readField('id', edge?.node);
                  if (id && !edgeMap.has(id)) {
                    edgeMap.set(id, edge);
                  }
                },
              );

              return {
                ...incoming,
                edges: Array.from(edgeMap.values()),
              };
            },
          },
          invitesConnection: {
            keyArgs: false,
            merge(existing, incoming, { args }) {
              if (!incoming) return existing;
              if (!existing || !args?.invitesCursor) return incoming;

              return {
                ...incoming,
                edges: [...(existing.edges || []), ...(incoming.edges || [])],
              };
            },
          },
          pantriesConnection: {
            keyArgs: false,
            merge(existing, incoming, { args }) {
              if (!incoming) return existing;
              if (!existing || !args?.pantriesCursor) return incoming;

              return {
                ...incoming,
                edges: [...(existing.edges || []), ...(incoming.edges || [])],
              };
            },
          },
        },
      },
      Pantry: {
        keyFields: ['id'],
        fields: {
          items: {
            // Merge pantry items intelligently to prevent cache data loss
            // Uses same version-based conflict resolution as Query.pantryItems
            merge(existing, incoming, { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
          itemsConnection: {
            // No keyArgs - cursor-based pagination uses the cursor, not cache key
            keyArgs: false,
            merge(existing, incoming, { args, readField }) {
              // If no incoming data, preserve existing
              if (!incoming) return existing;

              // If no existing data or this is an initial load (no cursor), return incoming
              if (!existing || !args?.itemsCursor) {
                return incoming;
              }

              // This is pagination (cursor provided) - merge edges
              const existingEdges = existing.edges || [];
              const incomingEdges = incoming.edges || [];

              // Deduplicate by node ID to prevent duplicates
              const edgeMap = new Map();

              [...existingEdges, ...incomingEdges].forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id && !edgeMap.has(id)) {
                  edgeMap.set(id, edge);
                }
              });

              return {
                ...incoming,
                edges: Array.from(edgeMap.values()),
              };
            },
          },
          storageLocationsConnection: {
            keyArgs: false,
            merge(existing, incoming, { args }) {
              if (!incoming) return existing;
              if (!existing || !args?.storageLocationsCursor) return incoming;

              // Pagination - append edges
              return {
                ...incoming,
                edges: [...(existing.edges || []), ...(incoming.edges || [])],
              };
            },
          },
        },
      },
      PantryItem: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
      },
      Recipe: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
      },
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
          recipes: {
            keyArgs: ['category', 'difficulty'],
            merge(existing, incoming, { args, readField }) {
              if (!incoming) return existing;
              if (!existing || !args?.cursor) return incoming;

              // Pagination - merge edges with deduplication
              const existingEdges = existing.edges || [];
              const incomingEdges = incoming.edges || [];
              const edgeMap = new Map();

              [...existingEdges, ...incomingEdges].forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id && !edgeMap.has(id)) {
                  edgeMap.set(id, edge);
                }
              });

              return {
                ...incoming,
                edges: Array.from(edgeMap.values()),
              };
            },
          },
        },
      },
    },
  });

  // Monitor cache size and trigger garbage collection when approaching limit
  // This prevents unbounded growth and OOM errors on long-running sessions
  const MAX_CACHE_SIZE_MB = 100;
  const GC_THRESHOLD = 0.8; // Trigger GC at 80% capacity

  // Check cache size periodically (every 5 minutes)
  let gcInterval: NodeJS.Timeout;

  const monitorCacheSize = () => {
    try {
      const cacheData = cache.extract();
      const estimatedSize = JSON.stringify(cacheData).length;
      const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
      const usageRatio = estimatedSize / maxSizeBytes;

      if (usageRatio > GC_THRESHOLD) {
        console.warn(
          `⚠️ Apollo Cache at ${(usageRatio * 100).toFixed(1)}% capacity (${(estimatedSize / 1024 / 1024).toFixed(2)}MB). Running garbage collection...`
        );

        // Run garbage collection with result cache reset
        // This removes unreachable objects and orphaned data
        const removedIds = cache.gc({ resetResultCache: true });

        console.log(`🗑️ Garbage collected ${removedIds.length} unreachable cache objects`);

        // If still over threshold after GC, log warning
        const newSize = JSON.stringify(cache.extract()).length;
        const newRatio = newSize / maxSizeBytes;

        if (newRatio > GC_THRESHOLD) {
          console.error(
            `❌ Cache still at ${(newRatio * 100).toFixed(1)}% after GC. Consider increasing MAX_CACHE_SIZE_MB or reviewing data retention policies.`
          );
        }
      } else if (__DEV__) {
        console.log(
          `📊 Apollo Cache: ${(usageRatio * 100).toFixed(1)}% used (${(estimatedSize / 1024 / 1024).toFixed(2)}MB / ${MAX_CACHE_SIZE_MB}MB)`
        );
      }
    } catch (error) {
      console.error('Error monitoring cache size:', error);
    }
  };

  // Start monitoring in production and development
  gcInterval = setInterval(monitorCacheSize, 5 * 60 * 1000); // Every 5 minutes

  // Expose cleanup function for testing/logout
  (cache as any).__stopMonitoring = () => {
    if (gcInterval) {
      clearInterval(gcInterval);
    }
  };

  return cache;
}
