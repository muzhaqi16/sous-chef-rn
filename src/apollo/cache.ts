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

  // Preserve locally-created items the server hasn't confirmed yet. An offline
  // create writes the item (with its client-minted cuid) before the mutation
  // replays, so a background refetch that lands first must not drop it. Keep
  // existing items whose id still has a PENDING mutation in the offline queue;
  // once the queue drains, the authoritative server page wins. A genuinely
  // server-deleted item (no pending op) is correctly dropped. Mirrors the
  // pending-id guard in itemsConnectionFieldPolicy.
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
 * Preserve un-replayed local creates when an authoritative first page replaces
 * a connection. Keeps only existing edges whose `node.id` still has a PENDING
 * mutation in the offline queue and is absent from the incoming page — so an
 * offline create survives a refetch that wins the race against the queue drain,
 * while a genuinely server-deleted node (no pending op) is still dropped. Falls
 * straight through to `incoming` once the queue drains (pendingIds empty).
 * Shared by {@link itemsConnectionFieldPolicy} and
 * {@link mergeConnectionByNodeId} so the guard is encoded in one place.
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
 * Merge a cursorless (first-page) response into a cached connection, treating
 * the incoming page as authoritative for the window it covers.
 *
 * This is the difference between a refresh that works and one that only ever
 * adds. The append-only branch below keeps every existing edge in place and
 * appends whatever is new, which is right for `fetchMore` and wrong for a
 * refetch: an entry deleted on another device would stay on screen (it is in
 * `existing` and simply absent from `incoming`), and an entry that now sorts
 * first would keep its old position, taken from the cached edge rather than the
 * fresh page — pull-to-refresh appearing to do nothing.
 *
 * How much the page re-states is decided by `hasNextPage`, and only by it:
 *
 * - `false` — the response is the entire list, so it replaces the whole
 *   connection. Anything cached and absent from it is gone.
 * - `true` — the response is the first page of a longer list, so it replaces
 *   the first page's worth of edges. Edges past its length were loaded by
 *   later `fetchMore` calls and survive, minus any id the fresh page now
 *   carries — an entry that sorted forward into the window must not appear
 *   twice.
 *
 * Position alone cannot make that call. A page can be short because entries
 * were deleted, in which case the "tail" is the deletions and keeping it puts
 * them back on screen.
 *
 * The resilience guard comes first: a transient or partial response (API
 * briefly unreachable, an `errorPolicy: 'ignore'` fallback, a 200 that arrives
 * mid-token-refresh) must not empty a populated list. Only `totalCount === 0`
 * is treated as the server genuinely saying everything is gone.
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
        // window it covers, so it replaces those edges rather than merging
        // into them. Gating this on `!hasNextPage` — as it used to — meant any
        // list long enough to paginate never saw a removal or a reorder.
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
    // Reference object, so `extractNodes` doesn't drop it and strict
    // (null-on-incomplete) useFragment consumers render null → phantom rows +
    // stale totalCount.
    // Filtering via `canRead` here drops those edges at the source and
    // decrements `totalCount` by however many were dropped.
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
 * Apollo InMemoryCache with intelligent merge functions.
 *
 * Uses version-based conflict resolution to handle mutation responses,
 * optimistic updates, and concurrent modifications. Targeted `cache.evict()`
 * + `cache.gc()` at known eviction points (logout, item deletion) keep the
 * cache bounded — no periodic sweep needed.
 *
 * **No type declares `keyFields: ['id']`.** That is already Apollo's default,
 * so writing it out looks harmless — but declaring `keyFields` at all switches
 * the cache key to its explicit form: `PantryItem:{"id":"abc"}` instead of
 * `PantryItem:abc`. Twenty-seven types spelled out the default and silently got
 * the other format, which broke every consumer that reads a key back:
 * `queueManager.findCachedTypename` looks for a key ending in `:<entityId>`,
 * found nothing for any of them, and so never evicted a failed mutation's
 * entity or cleared its persisted optimistic fields.
 *
 * Add `keyFields` only for a type that is genuinely keyed on something other
 * than `id`, and expect the explicit key format when you do.
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
      // A nested object with NO type policy is REPLACED wholesale on write, not
      // merged field-by-field. Verified against the installed
      // @apollo/client@4.1.7 — re-derive with:
      //
      //   node -e "const {InMemoryCache, gql} = require('@apollo/client');
      //   const c = new InMemoryCache();
      //   const Q1 = gql\`{ shoppingListItem(id:\"1\") { id purchaseInfo {
      //     isPurchased purchaseDate purchasedBy { id } } } }\`;
      //   const Q2 = gql\`{ shoppingListItem(id:\"1\") { id purchaseInfo {
      //     isPurchased purchasedQuantity } } }\`; /* write Q1 then Q2 */
      //   console.log(c.diff({query: Q1, optimistic: false}).complete)"  // false
      //
      // Eleven operations select `purchaseInfo { isPurchased }` and nothing
      // else — GetShoppingListItemsFiltered (refetched cache-and-network on
      // every list visit), the item subscription fragment, both offline-queue
      // fragments, both purchase mutations. ItemDetail selects all five fields
      // and returns null when its fragment reads incomplete, so without these
      // policies any one of those writes lands under the open detail screen and
      // it renders "Item not found" — with the item sitting right there in the
      // cache, minus the four fields the last writer didn't ask for.
      //
      // The trade with a plain `merge: true` is that a field only ever leaves
      // the object when a write overwrites it — and the five purchase fields
      // are ONE FACT, not five. A narrow write that flips `isPurchased` leaves
      // the previous purchase's amounts and purchaser sitting beside the new
      // flag, and the detail screen attributes them to the new purchase: buy an
      // item, have a collaborator unmark and re-buy it, and their purchase
      // shows your name and your amounts. Gating every consumer on
      // `isPurchased` does not help, because `isPurchased` is precisely the
      // field the narrow write sets.
      //
      // So the merge expresses the invariant instead: a write that CHANGES
      // `isPurchased` describes a different purchase, so the fields it does not
      // carry are cleared rather than inherited. A write that leaves
      // `isPurchased` alone is a partial read of the SAME purchase and merges
      // field-wise as before — which is what keeps a list refetch from blanking
      // an open detail screen.
      //
      // Cleared means written as `null`, never removed. Every dependent field
      // is nullable in the schema, and an explicit null still reads COMPLETE —
      // whereas removing them would blank the detail screen, which is the bug
      // the policy exists to prevent. So the two failures are avoided together
      // rather than traded against each other.
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
