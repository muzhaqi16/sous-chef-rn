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
  // If incoming is null/undefined, keep existing (preserves cache on network errors)
  // But if incoming is an explicit empty array [], the user genuinely has no items
  if (incoming == null) {
    return existing || [];
  }

  if (incoming.length === 0) {
    return [];
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
 * Generic merge function for cursor-based connection pagination.
 *
 * Deduplicates edges by node ID, with incoming edges taking precedence
 * over existing ones (fresh data wins). When no cursor is provided
 * (initial load), incoming data replaces existing data entirely.
 *
 * @param cursorArgName - The GraphQL argument name for the cursor (e.g. 'after', 'membersCursor')
 */
function mergeConnectionByNodeId(cursorArgName: string) {
  return {
    keyArgs: (cursorArgName === 'after' ? ['filters'] : false) as false | string[],
    merge(existing: any, incoming: any, { args, readField }: any) {
      if (!incoming) return existing;
      if (!existing || !args?.[cursorArgName]) return incoming;

      const edgeMap = new Map();
      (existing.edges || []).forEach((edge: any) => {
        const id = readField('id', edge?.node);
        if (id) edgeMap.set(id, edge);
      });
      (incoming.edges || []).forEach((edge: any) => {
        const id = readField('id', edge?.node);
        if (id) edgeMap.set(id, edge);
      });

      return {
        ...incoming,
        edges: Array.from(edgeMap.values()),
      };
    },
  };
}

/**
 * Shared field policy for paginated itemsConnection fields.
 *
 * Used by both ShoppingList.itemsConnection and Pantry.itemsConnection
 * to avoid duplicating the same merge logic. Deduplicates edges by node ID,
 * uses 'filters' as keyArgs for separate cache entries, and handles
 * initial load vs. pagination (cursor-based) correctly.
 */
function itemsConnectionFieldPolicy() {
  return {
    keyArgs: ['filters'],
    merge(existing: any, incoming: any, { args, readField }: any) {
      if (!incoming) return existing;
      if (!existing || !args?.after) return incoming;

      // Pagination: merge edges with deduplication by node ID
      const edgeMap = new Map();
      (existing.edges || []).forEach((edge: any) => {
        const id = readField('id', edge?.node);
        if (id) edgeMap.set(id, edge);
      });
      (incoming.edges || []).forEach((edge: any) => {
        const id = readField('id', edge?.node);
        if (id) edgeMap.set(id, edge);
      });

      return {
        ...incoming,
        edges: Array.from(edgeMap.values()),
      };
    },
  };
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
// Track the dev-mode cache monitoring interval for cleanup
let cacheMonitoringInterval: NodeJS.Timeout | null = null;

/**
 * Stop the dev-mode cache size monitoring interval.
 * Called during logout to prevent stale interval from running.
 */
export function stopCacheMonitoring(): void {
  if (cacheMonitoringInterval) {
    clearInterval(cacheMonitoringInterval);
    cacheMonitoringInterval = null;
  }
}

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
          itemsConnection: itemsConnectionFieldPolicy(),
          suggestions: {
            merge(existing = [], incoming) {
              if (incoming == null) return existing;
              return incoming;
            },
          },
        },
      },
      Home: {
        keyFields: ['id'],
        fields: {
          membersConnection: mergeConnectionByNodeId('membersCursor'),
          invitesConnection: mergeConnectionByNodeId('invitesCursor'),
          pantriesConnection: mergeConnectionByNodeId('pantriesCursor'),
          shoppingListsConnection: mergeConnectionByNodeId('after'),
          mealPlansConnection: mergeConnectionByNodeId('after'),
          mealTemplatesConnection: mergeConnectionByNodeId('after'),
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
            keyArgs: ['filters', 'orderBy'],
            merge(existing: any, incoming: any, { args, readField }: any) {
              if (!incoming) return existing;
              if (!existing || !args?.after) return incoming;

              // Pagination: merge edges with deduplication by node ID
              const edgeMap = new Map();
              (existing.edges || []).forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id) edgeMap.set(id, edge);
              });
              (incoming.edges || []).forEach((edge: any) => {
                const id = readField('id', edge?.node);
                if (id) edgeMap.set(id, edge);
              });

              return {
                ...incoming,
                edges: Array.from(edgeMap.values()),
              };
            },
          },
          storageLocationsConnection: mergeConnectionByNodeId('after'),
          suggestions: {
            merge(existing = [], incoming) {
              if (incoming == null) return existing;
              return incoming;
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
      StorageLocation: { keyFields: ['id'] },
      Notification: { keyFields: ['id'] },
      Category: { keyFields: ['id'] },
      Brand: { keyFields: ['id'] },
      Membership: { keyFields: ['id'] },
      HomeInvite: { keyFields: ['id'] },
      ShoppingListCollaborator: { keyFields: ['id'] },
      Purchase: { keyFields: ['id'] },
      Store: { keyFields: ['id'] },
      SavedRecipe: { keyFields: ['id'] },
      NotificationPreferences: { keyFields: ['id'] },
      DietaryProfile: { keyFields: ['id'] },
      UserProfile: { keyFields: ['id'] },
      UserSettings: { keyFields: ['id'] },
      RecipeIngredient: { keyFields: ['id'] },
      Item: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
        fields: {
          imageUrl: {
            // Preserve existing imageUrl only if the field was not included in the response
            // (incoming === undefined). Allow explicit null through so users can remove images.
            merge(existing, incoming) {
              if (incoming === undefined) {
                return existing;
              }
              return incoming;
            },
          },
          nutritions: {
            merge(existing, incoming) {
              if (incoming === undefined) {
                return existing;
              }
              return incoming;
            },
          },
          images: {
            merge(existing, incoming) {
              if (incoming === undefined) {
                return existing;
              }
              return incoming;
            },
          },
        },
      },
      Recipe: {
        keyFields: ['id'],
        merge: true, // Enable automatic field-level merging for partial data
      },
      MealPlan: {
        keyFields: ['id'],
        merge: true,
        fields: {
          mealPlanItems: {
            merge(existing, incoming, { readField }) {
              return mergeArrayByIdIntelligent(existing, incoming, {
                readField,
              });
            },
          },
        },
      },
      MealPlanItem: {
        keyFields: ['id'],
        merge: true,
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
              // Preserve existing cache only on network errors (null/undefined)
              // Allow empty arrays through - user may genuinely have no lists
              if (incoming == null) {
                return existing;
              }
              return incoming;
            },
          },
          pantries: {
            // Different homes have different pantries - cache separately
            keyArgs: ['homeId'],
            merge(existing = [], incoming) {
              if (incoming == null) {
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
              if (incoming == null) {
                return existing;
              }
              return incoming;
            },
          },
          storageLocationTree: {
            // Different homes have different storage location trees - cache separately
            keyArgs: ['homeId'],
            merge(existing = [], incoming) {
              if (incoming == null) {
                return existing;
              }
              return incoming;
            },
          },
          pantryItemSuggestions: {
            // Different pantries have different suggestions - cache separately
            // Note: 'limit' excluded from keyArgs to avoid unnecessary cache fragmentation
            keyArgs: ['pantryId'],
            merge(existing = [], incoming) {
              if (incoming == null) {
                return existing;
              }
              return incoming;
            },
          },
          shoppingListSuggestions: {
            // Note: 'limit' excluded from keyArgs to avoid unnecessary cache fragmentation
            keyArgs: ['shoppingListId'],
            merge(existing = [], incoming) {
              if (incoming == null) {
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
            merge: mergeConnectionByNodeId('cursor').merge,
          },
          mealPlans: {
            ...mergeConnectionByNodeId('after'),
            keyArgs: ['filters'],
          },
        },
      },
    },
  });

  const MAX_CACHE_SIZE_MB = 100;
  const GC_THRESHOLD = 0.8; // Trigger GC at 80% capacity
  const SAMPLE_SIZE = 100; // Sample first 100 top-level keys for estimation

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
        sampleObjectCount += 1;
        if (Array.isArray(val)) {
          sampleObjectCount += val.length;
        } else {
          sampleObjectCount += Object.keys(val).length;
        }
      }
    }

    const avgObjectsPerKey = sampleObjectCount / sampleKeys.length;
    const estimatedTotalObjects = avgObjectsPerKey * totalKeys;

    // Rough estimate: ~1KB per object on average
    return estimatedTotalObjects * 1024;
  };

  const runCacheGC = () => {
    try {
      const cacheData = cache.extract();
      const estimatedSize = estimateCacheSizeSampled(cacheData);
      const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
      const usageRatio = estimatedSize / maxSizeBytes;

      if (usageRatio > GC_THRESHOLD) {
        if (__DEV__) {
          console.warn(
            `⚠️ Apollo Cache at ${(usageRatio * 100).toFixed(1)}% capacity (~${(estimatedSize / 1024 / 1024).toFixed(2)}MB). Running garbage collection...`
          );
        }

        const removedIds = cache.gc({ resetResultCache: true });

        if (__DEV__) {
          console.log(`🗑️ Garbage collected ${removedIds.length} unreachable cache objects`);

          const newSize = estimateCacheSizeSampled(cache.extract());
          const newRatio = newSize / maxSizeBytes;

          if (newRatio > GC_THRESHOLD) {
            console.error(
              `❌ Cache still at ${(newRatio * 100).toFixed(1)}% after GC. Consider increasing MAX_CACHE_SIZE_MB or reviewing data retention policies.`
            );
          }
        }
      } else if (__DEV__) {
        console.log(
          `📊 Apollo Cache: ${(usageRatio * 100).toFixed(1)}% used (~${(estimatedSize / 1024 / 1024).toFixed(2)}MB / ${MAX_CACHE_SIZE_MB}MB)`
        );
      }
    } catch (_error) {
      if (__DEV__) {
        console.error('Error monitoring cache size:', _error);
      }
    }
  };

  // Clear any existing interval before creating new one (prevents memory leak during hot reload)
  stopCacheMonitoring();

  // Dev: monitor every 5 minutes with logging
  // Production: GC check every 10 minutes (sampling takes <5ms, safe for prod)
  const interval = __DEV__ ? 5 * 60 * 1000 : 10 * 60 * 1000;
  cacheMonitoringInterval = setInterval(runCacheGC, interval);

  return cache;
}
