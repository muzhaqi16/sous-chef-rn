import { InMemoryCache, isReference } from '@apollo/client';
import type {
  FieldFunctionOptions,
  Reference,
  StoreObject,
} from '@apollo/client';
// Import generated fragment matcher for proper interface/union type handling
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';
import { queueStore } from './offlineQueue/queueStore';
import { logger } from '#/utils/environment';

// Apollo's `readField` accessor, extracted from the field-policy options bag.
type ReadField = FieldFunctionOptions['readField'];

// Minimal shape of a Relay-style connection as it lives in the normalized
// cache: edges wrap normalized node references, plus pagination metadata.
interface CachedEdge {
  node?: Reference;
}
interface CachedConnection {
  edges?: CachedEdge[];
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string | null;
  } | null;
  totalCount?: number;
}

/**
 * Maximum number of edges to retain in an itemsConnection cache entry.
 * When a merge would exceed this limit, the oldest edges are evicted.
 * 100 = 2 pages of 50 (pantry) or 5 pages of 20 (shopping list).
 */
const MAX_WINDOW_EDGES = 100;

/**
 * Version-aware merge: optimistic (`temp-`) items survive until the server
 * confirms, and conflicts resolve on `version`, falling back to `updatedAt`.
 */
function mergeArrayByIdIntelligent<T extends { id: string; __ref?: string }>(
  existing: T[] = [],
  incoming: T[] = [],
  { readField }: Pick<FieldFunctionOptions, 'readField'>,
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
    const id = readField<string>('id', item);
    if (id) {
      existingMap.set(id, {
        item,
        version: readField<number>('version', item) || 0,
        updatedAt: readField<string>('updatedAt', item) || '',
      });
    }
  });

  // Create a map of incoming items by ID with version metadata
  const incomingMap = new Map<
    string,
    { item: T; version: number; updatedAt: string }
  >();
  incoming.forEach(item => {
    const id = readField<string>('id', item);
    if (id) {
      incomingMap.set(id, {
        item,
        version: readField<number>('version', item) || 0,
        updatedAt: readField<string>('updatedAt', item) || '',
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

  // Keep existing items whose id still has a PENDING queue mutation, so an
  // offline create survives a refetch that beats the queue drain. Once the
  // queue empties the server page wins, and a genuinely deleted item (no
  // pending op) is dropped. Mirrors the guard in itemsConnectionFieldPolicy.
  const pendingIds = queueStore.getPendingClientIds();
  existingMap.forEach(({ item }, id) => {
    if (incomingMap.has(id)) {
      return; // Already processed above
    }
    if (pendingIds.has(id)) {
      merged.push(item);
    }
  });

  return merged;
}

/**
 * Reads the `node.id` from a connection edge via Apollo's `readField` helper.
 * Returns undefined when the edge or its node is missing — callers should skip
 * those edges rather than treat them as deduplication keys.
 */
function readEdgeNodeId(
  edge: CachedEdge | undefined,
  readField: ReadField,
): string | undefined {
  const node = edge?.node;
  if (!node) return undefined;
  return readField<string>('id', node);
}

/**
 * Decides whether to preserve `existing.pageInfo` instead of overwriting it
 * with `incoming.pageInfo`. Existing wins on a background refetch (no cursor)
 * when the server returned fewer edges than the cache already has — a common
 * pattern when only page 1 refreshes while cache holds pages 1+2.
 */
function shouldPreservePageInfo(
  existing: CachedConnection,
  incoming: CachedConnection,
  args: { after?: string | null } | null,
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
 * Preserve un-replayed local creates when an authoritative first page replaces a
 * connection: keeps only edges whose `node.id` still has a PENDING queue
 * mutation and is absent from the incoming page. Falls straight through once
 * the queue drains. Shared so the guard is encoded in one place.
 */
function preservePendingEdges(
  existing: CachedConnection,
  incoming: CachedConnection,
  readField: ReadField,
): CachedConnection {
  const pendingIds = queueStore.getPendingClientIds();
  if (pendingIds.size === 0) return incoming;
  const incomingIds = new Set<string>();
  for (const edge of incoming.edges || []) {
    const id = readEdgeNodeId(edge, readField);
    if (id) incomingIds.add(id);
  }
  const preservedEdges = (existing.edges || []).filter(edge => {
    const id = readEdgeNodeId(edge, readField);
    return id != null && pendingIds.has(id) && !incomingIds.has(id);
  });
  if (preservedEdges.length === 0) return incoming;
  if (__DEV__) {
    logger.debug(
      `🛡️ [Cache] preserved ${preservedEdges.length} un-replayed local edge(s) over the authoritative page`,
    );
  }
  return {
    ...incoming,
    edges: [...preservedEdges, ...(incoming.edges || [])],
    totalCount: (incoming.totalCount ?? 0) + preservedEdges.length,
  };
}

/**
 * Merge a cursorless first page as authoritative for the window it covers.
 * `hasNextPage` decides how much it restates: `false` replaces the whole
 * connection, `true` replaces the first page's worth and keeps later
 * `fetchMore` edges. Only `totalCount === 0` may empty a populated list.
 */
function mergeAuthoritativeFirstPage(
  existing: CachedConnection,
  incoming: CachedConnection,
  readField: ReadField,
): CachedConnection {
  const incomingEdges = incoming.edges || [];
  const existingEdges = existing.edges || [];

  const authoritativeEmpty = incoming.totalCount === 0;
  if (
    incomingEdges.length === 0 &&
    existingEdges.length > 0 &&
    !authoritativeEmpty
  ) {
    if (__DEV__) {
      logger.debug(
        `🛡️ [Cache] preserved ${existingEdges.length} cached edge(s) — ignored empty/partial incoming (totalCount=${incoming.totalCount})`,
      );
    }
    return existing;
  }

  const incomingIds = new Set<string>();
  for (const edge of incomingEdges) {
    const id = readEdgeNodeId(edge, readField);
    if (id) incomingIds.add(id);
  }

  const coversWholeList = !incoming.pageInfo?.hasNextPage;
  const tail = coversWholeList
    ? []
    : existingEdges.slice(incomingEdges.length).filter(edge => {
        const id = readEdgeNodeId(edge, readField);
        return id != null && !incomingIds.has(id);
      });

  const merged: CachedConnection = {
    ...incoming,
    edges: tail.length > 0 ? [...incomingEdges, ...tail] : incomingEdges,
    // A surviving tail means the loaded window still extends past this page, so
    // the cached cursor — not this page's — describes where `fetchMore` resumes.
    ...(tail.length > 0 && existing.pageInfo
      ? { pageInfo: existing.pageInfo }
      : {}),
  };

  return preservePendingEdges(existing, merged, readField);
}

/**
 * Connection merge where fresh server data wins on duplicate node ids
 * (last-write-wins), for connections with no paginated window. Append-only
 * paginated lists use {@link itemsConnectionFieldPolicy} instead, which keeps
 * existing edge positions and bounds the window.
 */
function mergeConnectionByNodeId(keyArgs: string[] = ['filters']) {
  return {
    keyArgs,
    // Same self-healing read as itemsConnectionFieldPolicy — drop dangling
    // `edge.node` refs (post-eviction) and decrement totalCount accordingly.
    // See the read() comment in itemsConnectionFieldPolicy for context.
    read(
      existing: CachedConnection | undefined,
      { canRead }: FieldFunctionOptions,
    ) {
      if (!existing?.edges?.length) return existing;
      const validEdges = existing.edges.filter((edge: CachedEdge) =>
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
    merge(
      existing: CachedConnection | undefined,
      incoming: CachedConnection | undefined,
      { args, readField }: FieldFunctionOptions<{ after?: string | null }>,
    ) {
      if (!incoming) return existing;
      if (!existing) return incoming;
      if (!args?.after) {
        // No cursor means a refresh, not a page: the response re-states the
        // window it covers, so it replaces those edges rather than merging in.
        // Gating on `!hasNextPage` would hide every removal and reorder in a
        // list long enough to paginate.
        return mergeAuthoritativeFirstPage(existing, incoming, readField);
      }

      const edgeMap = new Map<string, CachedEdge>();
      const existingEdges = existing.edges || [];
      existingEdges.forEach((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge, readField);
        if (id) edgeMap.set(id, edge);
      });
      const existingCount = edgeMap.size;
      (incoming.edges || []).forEach((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge, readField);
        if (id) edgeMap.set(id, edge);
      });

      const preservePageInfo = shouldPreservePageInfo(existing, incoming, args);

      if (__DEV__ && preservePageInfo) {
        logger.debug(
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
 * Paginated append-only merge with a bounded window: existing edges keep their
 * positions, only new node ids are appended, and the result is capped at
 * MAX_WINDOW_EDGES so memory stays bounded. Use
 * {@link mergeConnectionByNodeId} where fresh data should overwrite duplicates.
 */
function itemsConnectionFieldPolicy(keyArgs: string[] = ['filters']) {
  return {
    keyArgs,
    // Self-heal dangling refs: Apollo's broken-ref filter handles plain lists,
    // never a nested `edge.node`, so an evicted entity leaves a truthy
    // Reference that renders as a phantom row with a stale totalCount.
    // `canRead` drops those edges and decrements the count.
    read(
      existing: CachedConnection | undefined,
      { canRead }: FieldFunctionOptions,
    ) {
      if (!existing?.edges?.length) return existing;
      const validEdges = existing.edges.filter((edge: CachedEdge) =>
        edge?.node ? canRead(edge.node) : false,
      );
      if (validEdges.length === existing.edges.length) return existing;
      const dropped = existing.edges.length - validEdges.length;
      if (__DEV__) {
        logger.debug(
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
    merge(
      existing: CachedConnection | undefined,
      incoming: CachedConnection | undefined,
      { args, readField }: FieldFunctionOptions<{ after?: string | null }>,
    ) {
      if (!incoming) return existing;
      if (!existing) return incoming;
      if (!args?.after) {
        // No cursor means a refresh, not a page. See
        // `mergeAuthoritativeFirstPage` for why this must not also require
        // `!hasNextPage`, and for the empty-response and pending-create guards
        // it carries.
        return mergeAuthoritativeFirstPage(existing, incoming, readField);
      }

      // Append-only: keep existing edges in place, add only new incoming edges
      const existingIds = new Set<string>();
      for (const edge of existing.edges || []) {
        const id = readEdgeNodeId(edge, readField);
        if (id) existingIds.add(id);
      }

      const newEdges = (incoming.edges || []).filter((edge: CachedEdge) => {
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
        logger.debug(
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
          logger.debug(
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
          logger.debug(
            `📊 [Cache] itemsConnection evicted ${evictCount} oldest edges, remaining=${mergedEdges.length}`,
          );
        }
      }

      // Connection size is a release signal — an unbounded connection is what
      // makes the persisted cache expensive to restore.
      import('#services/telemetry')
        .then(({ Telemetry }) =>
          Telemetry.gauge('apollo_cache_edge_count', mergedEdges.length, {
            field: 'itemsConnection',
          }),
        )
        .catch(() => {});

      if (__DEV__) {
        const existingCount = existing?.edges?.length ?? 0;
        const incomingCount = incoming?.edges?.length ?? 0;
        const hasCursor = !!args?.after;
        logger.debug(
          `📊 [Cache] itemsConnection merge: existing=${existingCount} incoming=${incomingCount} merged=${mergedEdges.length} cursor=${hasCursor}`,
        );
      }

      return { ...incoming, pageInfo, edges: mergedEdges };
    },
  };
}

/**
 * **No type declares `keyFields: ['id']`.** It is already Apollo's default, and
 * declaring it switches the cache key to its explicit form
 * (`PantryItem:{"id":"abc"}`, not `PantryItem:abc`), breaking every consumer
 * that reads a key back. Declare it only for a genuinely different key.
 */

export function makeCache(): InMemoryCache {
  const cache = new InMemoryCache({
    // Configure possibleTypes for proper fragment matching on interfaces
    // This ensures Apollo can correctly normalize types implementing Node, Connection, Edge
    possibleTypes: fragmentMatcherData.possibleTypes,

    typePolicies: {
      ShoppingListItem: {
        merge: true, // Enable automatic field-level merging for partial data
        fields: {
          unit: {
            merge: false, // Always replace unit with incoming data, never merge
          },
          // Purchase history is a cursor-paginated connection; merge pages by
          // node id (keyed on orderBy only, so first/after don't fragment the
          // cache entry) so `fetchMore` appends instead of replacing.
          purchasesConnection: mergeConnectionByNodeId(['orderBy']),
        },
      },
      // A nested object with no type policy is REPLACED wholesale on write, so
      // a narrow `purchaseInfo { isPurchased }` write would blank an open
      // detail screen. Plain `merge: true` is also wrong — the purchase fields
      // are ONE FACT, so a flipped `isPurchased` must not inherit the previous
      // purchase's amounts. So: an unchanged `isPurchased` merges field-wise, a
      // changed one clears what it omits as `null` (removing reads INCOMPLETE).
      ShoppingListItemPurchaseInfo: {
        merge(
          existing: StoreObject | Reference | undefined,
          incoming: StoreObject,
          options: FieldFunctionOptions,
        ) {
          if (!existing) return incoming;
          // A value object with no key fields is never stored as a reference,
          // but the parameter type admits one and `Object.keys` on a Reference
          // would build `{ __ref: null }` and write it over the object. Cheaper
          // to refuse the shape than to rely on it not occurring.
          if (isReference(existing)) return incoming;

          const wasPurchased = options.readField('isPurchased', existing);
          const isPurchased = options.readField('isPurchased', incoming);
          if (isPurchased === undefined || isPurchased === wasPurchased) {
            return options.mergeObjects(existing, incoming);
          }

          // Derived from what is actually stored rather than a hardcoded field
          // list, so a field added to the type is covered without anyone
          // remembering to add it here.
          const cleared: Record<string, null> = {};
          for (const field of Object.keys(existing)) {
            if (field !== '__typename' && !(field in incoming)) {
              cleared[field] = null;
            }
          }

          return options.mergeObjects({ ...existing, ...cleared }, incoming);
        },
      },
      PurchaseHistorySummary: { merge: true },
      ShoppingListItemSource: { merge: true },
      ShoppingListItemStoreInfo: { merge: true },
      PriceEstimate: { merge: true },
      ShoppingList: {
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
        merge: true, // Enable automatic field-level merging for partial data
        fields: {
          unit: {
            merge: false, // Always replace unit with incoming data, never merge
          },
          // Without a policy, keyArgs is every argument and a `fetchMore` page
          // lands under its own cursor — the list never grows.
          usageRecords: mergeConnectionByNodeId(['orderBy']),
        },
      },
      Item: {
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
        merge: true, // Enable automatic field-level merging for partial data
      },
      MealPlan: {
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
        merge: true,
      },
      User: {
        fields: {
          profile: {
            // Merge profile fields to prevent data loss when partial updates arrive
            // e.g., one query returns {displayName, avatar}, another returns {firstName, lastName}
            merge(existing, incoming, { mergeObjects }) {
              return mergeObjects(existing, incoming);
            },
          },
          savedRecipesConnection: mergeConnectionByNodeId(),
          // Keyed on filters + orderBy so the unread-badge query and the filtered
          // history feed keep separate paginated lists; edges merge by node id
          // so fetchMore appends pages.
          notificationsConnection: mergeConnectionByNodeId([
            'filters',
            'orderBy',
          ]),
        },
      },
      Query: {
        fields: {
          // Cache redirects: by-id lookups (GetShoppingListItemsFiltered,
          // GetPantry, the detail queries) resolve to the normalized entity
          // when ROOT_QUERY has never seen this id — essential for entities
          // created local-first while offline, where no server response ever
          // writes the ROOT_QUERY field.
          shoppingList: {
            read(
              existing: unknown,
              { args, toReference, canRead }: FieldFunctionOptions,
            ) {
              if (existing !== undefined) return existing;
              const ref = toReference({
                __typename: 'ShoppingList',
                id: args?.id as string,
              });
              return canRead(ref) ? ref : existing;
            },
          },
          shoppingListItem: {
            read(
              existing: unknown,
              { args, toReference, canRead }: FieldFunctionOptions,
            ) {
              if (existing !== undefined) return existing;
              const ref = toReference({
                __typename: 'ShoppingListItem',
                id: args?.id as string,
              });
              return canRead(ref) ? ref : existing;
            },
          },
          pantry: {
            read(
              existing: unknown,
              { args, toReference, canRead }: FieldFunctionOptions,
            ) {
              if (existing !== undefined) return existing;
              const ref = toReference({
                __typename: 'Pantry',
                id: args?.id as string,
              });
              return canRead(ref) ? ref : existing;
            },
          },
          recipe: {
            read(
              existing: unknown,
              { args, toReference, canRead }: FieldFunctionOptions,
            ) {
              if (existing !== undefined) return existing;
              const ref = toReference({
                __typename: 'Recipe',
                id: args?.id as string,
              });
              return canRead(ref) ? ref : existing;
            },
          },
          // The redirect is all-or-nothing: `canRead` only checks that the
          // entity EXISTS, so a `PantryItem` missing one field of
          // `PantryItemDetail_pantryItem` still reads incomplete and Apollo
          // goes to the network. It therefore only pays off paired with a
          // detail-complete optimistic write —
          // `optimisticEntityCompleteness.test.ts` is what keeps that true.
          pantryItem: {
            read(
              existing: unknown,
              { args, toReference, canRead }: FieldFunctionOptions,
            ) {
              if (existing !== undefined) return existing;
              const ref = toReference({
                __typename: 'PantryItem',
                id: args?.id as string,
              });
              return canRead(ref) ? ref : existing;
            },
          },
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
          // Batches for a pantry item are a Relay connection keyed by the item
          // (and optional status filter), so each item — and each active/all
          // view — keeps its own cached edge list; edges merge by node id.
          pantryItemBatchesConnection: mergeConnectionByNodeId([
            'pantryItemId',
            'status',
          ]),
          storageLocations: {
            // Different homes have different storage locations - cache separately
            keyArgs: ['homeId'],
            // A connection, not a list, so Apollo's broken-ref filtering never
            // reaches `edge.node`. Without this read an optimistic delete's
            // evict leaves a dangling node, the query goes incomplete, and
            // offline `usePreservedNodes` freezes the PRE-delete list.
            read(
              existing: CachedConnection | undefined,
              { canRead }: FieldFunctionOptions,
            ) {
              if (!existing?.edges?.length) return existing;
              const validEdges = existing.edges.filter((edge: CachedEdge) =>
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
            // MyRecipes passes category/difficulty nested inside `filters:` —
            // keying on the whole input object keeps each filter set in its
            // own entry (variable-less cache.updateQuery writers collapse to
            // the same `filters: {}` key on both write and read paths).
            keyArgs: ['filters'],
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
