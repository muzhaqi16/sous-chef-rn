/**
 * The field-policy primitives a feature's type policies are built from: cursor
 * connections keyed on the arguments that partition a list, and array merging
 * by entity id. Their own module so a policy needing one does not close a cycle
 * with `cache.ts`, which assembles them.
 */

// **No type declares `keyFields: ['id']`** — it is Apollo's default, and
// declaring it switches the key to `PantryItem:{"id":"abc"}`, breaking every
// consumer that reads one back. Declare it only for a genuinely different key.
import type {
  FieldFunctionOptions,
  FieldPolicy,
  Reference,
} from '@apollo/client';
import { queueStore } from './offlineQueue/queueStore';
import { logger } from '#/utils/environment';

// Apollo's `readField` accessor, extracted from the field-policy options bag.
type ReadField = FieldFunctionOptions['readField'];

// Minimal shape of a Relay-style connection as it lives in the normalized
// cache: edges wrap normalized node references, plus pagination metadata.
export interface CachedEdge {
  node?: Reference;
}
export interface CachedConnection {
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
 * 100 = 1 page of 100 (pantry, `PAGE_SIZE.MAX`) or 4 pages of 25 (shopping list).
 */
const MAX_WINDOW_EDGES = 100;

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
  const pendingIds = queueStore.getUnconfirmedCreateIds();
  if (pendingIds.size === 0) return incoming;
  const incomingIds = new Set<string>();
  for (const edge of incoming.edges ?? []) {
    const id = readEdgeNodeId(edge, readField);
    if (id) incomingIds.add(id);
  }
  const preservedEdges = (existing.edges ?? []).filter(edge => {
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
    edges: [...preservedEdges, ...(incoming.edges ?? [])],
    totalCount: (incoming.totalCount ?? 0) + preservedEdges.length,
  };
}

/**
 * The cached edges an authoritative first page leaves standing: those after the
 * cached position of the page's last already-held entry, minus any it restates.
 * A page sharing no entry with the cache cannot be placed, so it keeps none and
 * `fetchMore` reloads from the page's own cursor.
 */
function edgesPastFirstPage(
  existingEdges: CachedEdge[],
  incomingEdges: CachedEdge[],
  incomingIds: Set<string>,
  readField: ReadField,
): CachedEdge[] {
  const existingIndex = new Map<string, number>();
  existingEdges.forEach((edge, index) => {
    const id = readEdgeNodeId(edge, readField);
    if (id) existingIndex.set(id, index);
  });
  let cachedPosition = -1;
  for (const edge of incomingEdges) {
    const id = readEdgeNodeId(edge, readField);
    const position = id == null ? undefined : existingIndex.get(id);
    if (position !== undefined) cachedPosition = position;
  }
  if (cachedPosition < 0) return [];
  return existingEdges.slice(cachedPosition + 1).filter(edge => {
    const id = readEdgeNodeId(edge, readField);
    return id != null && !incomingIds.has(id);
  });
}

/**
 * Merge a cursorless first page as authoritative for the window it covers.
 * `hasNextPage` decides how much it restates: `false` replaces the whole
 * connection, `true` replaces the cached entries up to the page's last one and
 * keeps the rest. Only `totalCount === 0` may empty a populated list.
 */
function mergeAuthoritativeFirstPage(
  existing: CachedConnection,
  incoming: CachedConnection,
  readField: ReadField,
): CachedConnection {
  const incomingEdges = incoming.edges ?? [];
  const existingEdges = existing.edges ?? [];

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
    : edgesPastFirstPage(existingEdges, incomingEdges, incomingIds, readField);

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
 * A by-id root field (`pantryItem(id)`) reads the `typename` entity the cache
 * holds, so a row created on the device reads back before the server has it.
 */
export function readByIdFromCache(typename: string): FieldPolicy {
  return {
    read(existing: unknown, { args, toReference, canRead }) {
      // A stored `null` stands only while no such entity is held: an add that
      // reuses a line moved off the list writes it back under the same id.
      if (existing !== undefined && existing !== null) return existing;
      const ref = toReference({ __typename: typename, id: args?.id as string });
      return canRead(ref) ? ref : existing;
    },
  };
}

/**
 * Connection merge where fresh server data wins on duplicate node ids
 * (last-write-wins), for connections with no paginated window. Append-only
 * paginated lists use {@link itemsConnectionFieldPolicy} instead, which keeps
 * existing edge positions and bounds the window.
 */
export function mergeConnectionByNodeId(
  // `false` is one store field whatever arguments read it. An empty array is
  // not: Apollo keys a selection WITH arguments `field:{}` and a bare one
  // `field`, so the two never see each other's rows.
  keyArgs: string[] | false = ['filters'],
) {
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
        edge.node ? canRead(edge.node) : false,
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
      const existingEdges = existing.edges ?? [];
      existingEdges.forEach((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge, readField);
        if (id) edgeMap.set(id, edge);
      });
      const existingCount = edgeMap.size;
      (incoming.edges ?? []).forEach((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge, readField);
        if (id) edgeMap.set(id, edge);
      });

      // If no new edges were added, return stable reference when possible
      if (edgeMap.size === existingCount) {
        const pageInfoUnchanged =
          incoming.pageInfo?.hasNextPage === existing.pageInfo?.hasNextPage &&
          incoming.pageInfo?.endCursor === existing.pageInfo?.endCursor;
        const totalCountUnchanged =
          incoming.totalCount === undefined ||
          incoming.totalCount === existing.totalCount;

        if (pageInfoUnchanged && totalCountUnchanged) {
          return existing;
        }
        return { ...incoming, edges: existingEdges };
      }

      return { ...incoming, edges: Array.from(edgeMap.values()) };
    },
  };
}

/**
 * Paginated append-only merge with a bounded window: existing edges keep their
 * positions, only new node ids are appended, and the result is capped at
 * MAX_WINDOW_EDGES so memory stays bounded. Use
 * {@link mergeConnectionByNodeId} where fresh data should overwrite duplicates.
 */
export function itemsConnectionFieldPolicy(keyArgs: string[] = ['filters']) {
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
        edge.node ? canRead(edge.node) : false,
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
      for (const edge of existing.edges ?? []) {
        const id = readEdgeNodeId(edge, readField);
        if (id) existingIds.add(id);
      }

      const newEdges = (incoming.edges ?? []).filter((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge, readField);
        return id && !existingIds.has(id);
      });

      // A page of only already-cached ids leaves the cursor where the cache
      // already advanced past it, so existing pageInfo wins.
      if (newEdges.length === 0) {
        const totalCountUnchanged =
          incoming.totalCount === undefined ||
          incoming.totalCount === existing.totalCount;

        if (totalCountUnchanged) {
          return existing;
        }

        if (__DEV__) {
          const existingCount = existing.edges?.length ?? 0;
          const incomingCount = incoming.edges?.length ?? 0;
          logger.debug(
            `📊 [Cache] itemsConnection merge (stable): existing=${existingCount} incoming=${incomingCount} merged=${existingCount}`,
          );
        }
        return {
          ...incoming,
          pageInfo: existing.pageInfo,
          edges: existing.edges,
        };
      }

      let mergedEdges = [...(existing.edges ?? []), ...newEdges];

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
        const existingCount = existing.edges?.length ?? 0;
        const incomingCount = incoming.edges?.length ?? 0;
        logger.debug(
          `📊 [Cache] itemsConnection merge: existing=${existingCount} incoming=${incomingCount} merged=${mergedEdges.length}`,
        );
      }

      return { ...incoming, edges: mergedEdges };
    },
  };
}
