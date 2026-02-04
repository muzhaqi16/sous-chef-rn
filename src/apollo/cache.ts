import { InMemoryCache } from '@apollo/client';
import { relayStylePagination } from '@apollo/client/utilities';
// Import generated fragment matcher for proper interface/union type handling
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';

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
    // Configure possibleTypes for proper fragment matching on interfaces
    // This ensures Apollo can correctly normalize types implementing Node, Connection, Edge, Timestamped
    possibleTypes: fragmentMatcherData.possibleTypes,

    typePolicies: {
      ShoppingListItem: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
        fields: {
          unit: {
            merge: false, // Always replace unit with incoming data, never merge
          },
        },
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
            // Include filters in keyArgs so purchased/unpurchased have separate cache entries
            keyArgs: ['filters'],
            merge(existing, incoming, { args, readField }) {
              // Always preserve existing data if incoming is missing
              if (!incoming) return existing;

              // If no existing data or this is an initial load (no cursor), return incoming
              // This prevents stale items from persisting when items move between connections
              if (!existing || !args?.after) {
                return incoming;
              }

              // This is pagination (cursor provided) - merge edges with deduplication
              const existingEdges = existing.edges || [];
              const incomingEdges = incoming.edges || [];

              // Deduplicate by node ID to prevent duplicates during pagination
              const edgeMap = new Map();

              // Add existing edges first
              existingEdges.forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id && !edgeMap.has(id)) {
                  edgeMap.set(id, edge);
                }
              });

              // Add incoming edges (will overwrite existing with same ID)
              incomingEdges.forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id) {
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
            // Include filters in keyArgs so purchased/unpurchased have separate cache entries
            keyArgs: ['filters'],
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
        fields: {
          unit: {
            merge: false, // Always replace unit with incoming data, never merge
          },
        },
      },
      Unit: {
        keyFields: ['id'],
      },
      Item: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
        fields: {
          imageUrl: {
            // Preserve existing imageUrl if incoming mutation returns null
            // This prevents partial responses from clearing cached images
            merge(existing, incoming) {
              // If incoming is null but we have an existing value, keep existing
              if (incoming === null && existing) {
                return existing;
              }
              // Otherwise use incoming (handles updates and initial loads)
              return incoming;
            },
          },
        },
      },
      Recipe: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
      },
      User: {
        keyFields: ['id'],
        fields: {
          profile: {
            // Merge profile fields to prevent data loss when partial updates arrive
            // e.g., one query returns {displayName, avatar}, another returns {firstName, lastName}
            merge(existing, incoming, { mergeObjects }) {
              return mergeObjects(existing, incoming);
            },
          },
        },
      },
      Query: {
        fields: {
          // List-level queries (return collections of lists/homes)
          shoppingLists: {
            // Different homes have different shopping lists - cache separately per filter
            keyArgs: ['filters'],
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
          homes: relayStylePagination(),
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
          pantryItemSuggestions: {
            // Different pantries have different suggestions - cache separately
            keyArgs: ['pantryId', 'limit'],
            merge(existing = [], incoming) {
              // Suggestions are server-generated, so incoming replaces existing
              // Preserve existing if network request failed
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
          // Item lookups by filters (barcode/UPC, etc.) - cache separately per filter
          items: {
            keyArgs: ['filters'],
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

  // PERFORMANCE: Only monitor cache in development to avoid production overhead
  // Cache monitoring uses sampling for size estimation to minimize JS thread blocking
  if (__DEV__) {
    const MAX_CACHE_SIZE_MB = 100;
    const GC_THRESHOLD = 0.8; // Trigger GC at 80% capacity
    const SAMPLE_SIZE = 100; // Sample first 100 top-level keys for estimation

    // Track global interval to prevent memory leaks during hot reload
    let gcInterval: NodeJS.Timeout | null = null;

    // Optimized cache size estimator using sampling instead of full traversal
    // Samples first 100 keys and extrapolates, reducing 50-150ms to <5ms
    const estimateCacheSizeSampled = (obj: any): number => {
      const allKeys = Object.keys(obj);
      const totalKeys = allKeys.length;

      if (totalKeys === 0) return 0;

      // Sample first SAMPLE_SIZE keys to avoid full traversal
      const sampleKeys = allKeys.slice(0, Math.min(SAMPLE_SIZE, totalKeys));
      let sampleObjectCount = 0;

      for (const key of sampleKeys) {
        const val = obj[key];
        if (val && typeof val === 'object') {
          // Count first-level objects only
          sampleObjectCount += 1;
          // Rough estimate of nested objects (without deep traversal)
          if (Array.isArray(val)) {
            sampleObjectCount += val.length;
          } else {
            sampleObjectCount += Object.keys(val).length;
          }
        }
      }

      // Extrapolate from sample to estimate total
      const avgObjectsPerKey = sampleObjectCount / sampleKeys.length;
      const estimatedTotalObjects = avgObjectsPerKey * totalKeys;

      // Rough estimate: ~1KB per object on average
      return estimatedTotalObjects * 1024;
    };

    const monitorCacheSize = () => {
      try {
        const cacheData = cache.extract();
        const estimatedSize = estimateCacheSizeSampled(cacheData);
        const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
        const usageRatio = estimatedSize / maxSizeBytes;

        if (usageRatio > GC_THRESHOLD) {
          console.warn(
            `⚠️ Apollo Cache at ${(usageRatio * 100).toFixed(1)}% capacity (~${(estimatedSize / 1024 / 1024).toFixed(2)}MB). Running garbage collection...`
          );

          // Run garbage collection with result cache reset
          // This removes unreachable objects and orphaned data
          const removedIds = cache.gc({ resetResultCache: true });

          console.log(`🗑️ Garbage collected ${removedIds.length} unreachable cache objects`);

          // If still over threshold after GC, log warning
          const newSize = estimateCacheSizeSampled(cache.extract());
          const newRatio = newSize / maxSizeBytes;

          if (newRatio > GC_THRESHOLD) {
            console.error(
              `❌ Cache still at ${(newRatio * 100).toFixed(1)}% after GC. Consider increasing MAX_CACHE_SIZE_MB or reviewing data retention policies.`
            );
          }
        } else {
          console.log(
            `📊 Apollo Cache: ${(usageRatio * 100).toFixed(1)}% used (~${(estimatedSize / 1024 / 1024).toFixed(2)}MB / ${MAX_CACHE_SIZE_MB}MB)`
          );
        }
      } catch (error) {
        console.error('Error monitoring cache size:', error);
      }
    };

    // Clear any existing interval before creating new one (prevents memory leak during hot reload)
    if (gcInterval) {
      clearInterval(gcInterval);
    }

    // Monitor cache every 5 minutes in development (reduced from 2 min to minimize overhead)
    gcInterval = setInterval(monitorCacheSize, 5 * 60 * 1000);

    // Expose cleanup function for testing/logout
    (cache as any).__stopMonitoring = () => {
      if (gcInterval) {
        clearInterval(gcInterval);
        gcInterval = null;
      }
    };
  }

  return cache;
}
