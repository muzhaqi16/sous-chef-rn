import { InMemoryCache } from '@apollo/client';
// Import generated fragment matcher for proper interface/union type handling
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';

/**
 * Maximum number of edges to retain in an itemsConnection cache entry.
 * When a merge would exceed this limit, the oldest edges are evicted.
 * 100 = 2 pages of 50 (pantry) or 5 pages of 20 (shopping list).
 */
const MAX_WINDOW_EDGES = 100;

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
 * Reads the `node.id` from a connection edge via Apollo's `readField` helper.
 * Returns undefined when the edge or its node is missing — callers should skip
 * those edges rather than treat them as deduplication keys.
 */
function readEdgeNodeId(
  edge: any,
  readField: (field: string, ref: any) => any,
): string | undefined {
  const node = readField('node', edge);
  if (!node) return undefined;
  return readField('id', node) as string | undefined;
}

/**
 * Decides whether to preserve `existing.pageInfo` instead of overwriting it
 * with `incoming.pageInfo`. Existing wins on a background refetch (no cursor)
 * when the server returned fewer edges than the cache already has — a common
 * pattern when only page 1 refreshes while cache holds pages 1+2.
 */
function shouldPreservePageInfo(
  existing: any,
  incoming: any,
  args: any,
): boolean {
  const isBackgroundRefetch = !args?.after;
  const existingEdgeCount = (existing.edges || []).length;
  const incomingEdgeCount = (incoming.edges || []).length;
  return (
    isBackgroundRefetch &&
    existingEdgeCount > incomingEdgeCount &&
    !!existing.pageInfo
  );
}

/**
 * Connection merge for non-paginated-window lists where fresh server data
 * should win on duplicate node IDs.
 *
 * Used for membership/invites/saved-recipes-style connections where the
 * server's representation of a node is always authoritative. Incoming edges
 * overwrite existing ones at the same id (last-write-wins).
 *
 * For append-only paginated lists with cursor windows, use
 * {@link itemsConnectionFieldPolicy} instead — its dedup strategy preserves
 * existing edge positions and bounds the window via MAX_WINDOW_EDGES.
 */
function mergeConnectionByNodeId() {
  return {
    keyArgs: ['filters'] as string[],
    // Same self-healing read as itemsConnectionFieldPolicy — drop dangling
    // `edge.node` refs (post-eviction) and decrement totalCount accordingly.
    // See the read() comment in itemsConnectionFieldPolicy for context.
    read(existing: any, { canRead }: any) {
      if (!existing?.edges?.length) return existing;
      const validEdges = existing.edges.filter((edge: any) =>
        edge?.node ? canRead(edge.node) : false,
      );
      if (validEdges.length === existing.edges.length) return existing;
      const dropped = existing.edges.length - validEdges.length;
      return {
        ...existing,
        edges: validEdges,
        totalCount:
          typeof existing.totalCount === 'number'
            ? Math.max(0, existing.totalCount - dropped)
            : existing.totalCount,
      };
    },
    merge(existing: any, incoming: any, { args, readField }: any) {
      if (!incoming) return existing;
      if (!existing) return incoming;
      if (!args?.after && !incoming.pageInfo?.hasNextPage) return incoming;

      const edgeMap = new Map();
      const existingEdges = existing.edges || [];
      existingEdges.forEach((edge: any) => {
        const id = readEdgeNodeId(edge, readField);
        if (id) edgeMap.set(id, edge);
      });
      const existingCount = edgeMap.size;
      (incoming.edges || []).forEach((edge: any) => {
        const id = readEdgeNodeId(edge, readField);
        if (id) edgeMap.set(id, edge);
      });

      const preservePageInfo = shouldPreservePageInfo(existing, incoming, args);

      if (__DEV__ && preservePageInfo) {
        console.log(
          `📊 [Cache] preserved existing pageInfo (existing=${
            existingEdges.length
          } incoming=${(incoming.edges || []).length})`,
        );
      }

      // If no new edges were added, return stable reference when possible
      if (edgeMap.size === existingCount) {
        const pageInfoUnchanged =
          preservePageInfo ||
          (incoming.pageInfo?.hasNextPage === existing.pageInfo?.hasNextPage &&
            incoming.pageInfo?.endCursor === existing.pageInfo?.endCursor);
        const totalCountUnchanged =
          incoming.totalCount === undefined ||
          incoming.totalCount === existing.totalCount;

        if (pageInfoUnchanged && totalCountUnchanged) {
          return existing;
        }
        return {
          ...incoming,
          ...(preservePageInfo ? { pageInfo: existing.pageInfo } : {}),
          edges: existingEdges,
        };
      }

      return {
        ...incoming,
        ...(preservePageInfo ? { pageInfo: existing.pageInfo } : {}),
        edges: Array.from(edgeMap.values()),
      };
    },
  };
}

/**
 * Connection merge for paginated, append-only lists with a bounded edge window.
 *
 * Used by ShoppingList.itemsConnection and Pantry.itemsConnection. Existing
 * edges keep their positions; only incoming edges with new node IDs are
 * appended. The result is capped at MAX_WINDOW_EDGES — the oldest edges are
 * evicted when the window overflows, which keeps memory bounded for users
 * with thousands of historical items.
 *
 * For non-paginated connections where fresh data should overwrite duplicates,
 * use {@link mergeConnectionByNodeId} instead.
 */
function itemsConnectionFieldPolicy(keyArgs: string[] = ['filters']) {
  return {
    keyArgs,
    // Self-heal dangling refs: when an entity is evicted (delete mutation, gc,
    // cache restore from MMKV with stale edges), Apollo leaves the dangling
    // Reference inside `edge.node` because connections are `{ edges: [{ node }] }`
    // — its default broken-ref filter only handles plain lists of refs, not
    // nested `edge.node` shape. The unresolved ref still reads as a truthy
    // Reference object, so `extractNodes` doesn't drop it and `useFragment`
    // Pattern A consumers render null → phantom rows + stale totalCount.
    // Filtering via `canRead` here drops those edges at the source and
    // decrements `totalCount` by however many were dropped.
    read(existing: any, { canRead }: any) {
      if (!existing?.edges?.length) return existing;
      const validEdges = existing.edges.filter((edge: any) =>
        edge?.node ? canRead(edge.node) : false,
      );
      if (validEdges.length === existing.edges.length) return existing;
      const dropped = existing.edges.length - validEdges.length;
      if (__DEV__) {
        console.log(
          `📊 [Cache] itemsConnection read: dropped ${dropped} dangling edge(s)`,
        );
      }
      return {
        ...existing,
        edges: validEdges,
        totalCount:
          typeof existing.totalCount === 'number'
            ? Math.max(0, existing.totalCount - dropped)
            : existing.totalCount,
      };
    },
    merge(existing: any, incoming: any, { args, readField }: any) {
      if (!incoming) return existing;
      if (!existing) return incoming;
      if (!args?.after && !incoming.pageInfo?.hasNextPage) return incoming;

      // Append-only: keep existing edges in place, add only new incoming edges
      const existingIds = new Set<string>();
      for (const edge of existing.edges || []) {
        const id = readEdgeNodeId(edge, readField);
        if (id) existingIds.add(id);
      }

      const newEdges = (incoming.edges || []).filter((edge: any) => {
        const id = readEdgeNodeId(edge, readField);
        return id && !existingIds.has(id);
      });

      // Determine authoritative pageInfo once.
      // Existing pageInfo wins when:
      //   1. Background refetch (no cursor) returned fewer edges than cache has
      //   2. Cursor-based request returned all duplicates — we already advanced past that cursor
      const keepExistingPageInfo =
        shouldPreservePageInfo(existing, incoming, args) ||
        (!!args?.after && newEdges.length === 0);
      const pageInfo = keepExistingPageInfo
        ? existing.pageInfo
        : incoming.pageInfo;

      if (__DEV__ && keepExistingPageInfo) {
        console.log(
          `📊 [Cache] preserved existing pageInfo (existing=${
            (existing.edges || []).length
          } incoming=${(incoming.edges || []).length})`,
        );
      }

      // When no new edges, return stable reference when possible
      if (newEdges.length === 0) {
        const pageInfoUnchanged =
          pageInfo === existing.pageInfo &&
          incoming.pageInfo?.hasNextPage === existing.pageInfo?.hasNextPage &&
          incoming.pageInfo?.endCursor === existing.pageInfo?.endCursor;
        const totalCountUnchanged =
          incoming.totalCount === undefined ||
          incoming.totalCount === existing.totalCount;

        if (
          (keepExistingPageInfo || pageInfoUnchanged) &&
          totalCountUnchanged
        ) {
          return existing;
        }

        if (__DEV__) {
          const existingCount = existing?.edges?.length ?? 0;
          const incomingCount = incoming?.edges?.length ?? 0;
          const hasCursor = !!args?.after;
          console.log(
            `📊 [Cache] itemsConnection merge (stable): existing=${existingCount} incoming=${incomingCount} merged=${existingCount} cursor=${hasCursor}`,
          );
        }
        return { ...incoming, pageInfo, edges: existing.edges };
      }

      let mergedEdges = [...(existing.edges || []), ...newEdges];

      // Evict oldest edges when exceeding the window limit
      if (mergedEdges.length > MAX_WINDOW_EDGES) {
        const evictCount = mergedEdges.length - MAX_WINDOW_EDGES;
        mergedEdges = mergedEdges.slice(evictCount);

        if (__DEV__) {
          console.log(
            `📊 [Cache] itemsConnection evicted ${evictCount} oldest edges, remaining=${mergedEdges.length}`,
          );
        }
      }

      if (__DEV__) {
        const existingCount = existing?.edges?.length ?? 0;
        const incomingCount = incoming?.edges?.length ?? 0;
        const hasCursor = !!args?.after;
        console.log(
          `📊 [Cache] itemsConnection merge: existing=${existingCount} incoming=${incomingCount} merged=${mergedEdges.length} cursor=${hasCursor}`,
        );
        import('#services/telemetry')
          .then(({ Telemetry }) =>
            Telemetry.gauge('apollo_cache_edge_count', mergedEdges.length, {
              field: 'itemsConnection',
            }),
          )
          .catch(() => {});
      }

      return { ...incoming, pageInfo, edges: mergedEdges };
    },
  };
}

/**
 * Apollo InMemoryCache with intelligent merge functions.
 *
 * Uses version-based conflict resolution to handle mutation responses,
 * optimistic updates, and concurrent modifications. Targeted `cache.evict()`
 * + `cache.gc()` at known eviction points (logout, item deletion) keep the
 * cache bounded — no periodic sweep needed.
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
          membersConnection: mergeConnectionByNodeId(),
          invitesConnection: mergeConnectionByNodeId(),
          pantriesConnection: mergeConnectionByNodeId(),
          shoppingListsConnection: mergeConnectionByNodeId(),
          mealPlansConnection: mergeConnectionByNodeId(),
          mealTemplatesConnection: mergeConnectionByNodeId(),
        },
      },
      Pantry: {
        keyFields: ['id'],
        fields: {
          itemsConnection: itemsConnectionFieldPolicy(['filters', 'orderBy']),
          storageLocationsConnection: mergeConnectionByNodeId(),
          suggestions: {
            merge(existing = [], incoming) {
              if (incoming == null) return existing;
              return incoming;
            },
          },
          stats: {
            merge(existing, incoming, { mergeObjects }) {
              return mergeObjects(existing, incoming);
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
          batches: {
            merge: false, // Always replace batches array with incoming data
          },
        },
      },
      PantryItemBatch: {
        keyFields: ['id'],
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
          savedRecipesConnection: mergeConnectionByNodeId(),
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
          homes: mergeConnectionByNodeId(),
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
          // Item lookups by filters (barcode/UPC, etc.) - cache separately per filter
          items: {
            keyArgs: ['filters'],
          },
          recipes: {
            ...mergeConnectionByNodeId(),
            keyArgs: ['category', 'difficulty'],
          },
          mealPlans: {
            ...mergeConnectionByNodeId(),
            keyArgs: ['filters'],
          },
          mealTemplates: {
            ...mergeConnectionByNodeId(),
            keyArgs: ['filters'],
          },
        },
      },
    },
  });

  return cache;
}
