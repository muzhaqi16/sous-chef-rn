/**
 * Field-policy primitives the feature type policies build on, in their own
 * module so a policy needing one closes no import cycle with `cache.ts`.
 */

// **No type declares `keyFields: ['id']`** — it is Apollo's default, and
// declaring it switches the key to `PantryItem:{"id":"abc"}`, breaking every
// consumer that reads one back. Declare it only for a genuinely different key.
import type {
  FieldFunctionOptions,
  FieldPolicy,
  Reference,
} from '@apollo/client';
import { logger } from '#/utils/environment';
import { isRecord } from '#/utils/isRecord';

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
 * The id of the row an edge holds, from its cache reference. Never
 * `readField('id', node)`: Apollo stores a write's entities in the order it met
 * them, and a row selecting its parent list is met after that list, so a page's
 * new rows are not in the store yet when the list's merge runs. Verified:
 * `#apollo-a-merge-cannot-read-a-row-that-selects-its-parent`.
 */
function readEdgeNodeId(edge: CachedEdge | undefined): string | undefined {
  const ref = edge?.node?.__ref;
  return ref?.slice(ref.indexOf(':') + 1);
}

/**
 * The cached edges past the page's last already-held entry, minus any it
 * restates. A page sharing no entry cannot be placed, so it keeps none and
 * `fetchMore` reloads from the page's own cursor.
 */
function edgesPastFirstPage(
  existingEdges: CachedEdge[],
  incomingEdges: CachedEdge[],
  incomingIds: Set<string>,
): CachedEdge[] {
  const existingIndex = new Map<string, number>();
  existingEdges.forEach((edge, index) => {
    const id = readEdgeNodeId(edge);
    if (id) existingIndex.set(id, index);
  });
  let cachedPosition = -1;
  for (const edge of incomingEdges) {
    const id = readEdgeNodeId(edge);
    const position = id == null ? undefined : existingIndex.get(id);
    if (position !== undefined) cachedPosition = position;
  }
  if (cachedPosition < 0) return [];
  return existingEdges.slice(cachedPosition + 1).filter(edge => {
    const id = readEdgeNodeId(edge);
    return id != null && !incomingIds.has(id);
  });
}

/**
 * A cursorless first page is authoritative for its window: with no next page it
 * replaces the whole connection, else the cached entries up to its last one.
 * Only `totalCount === 0` may empty a populated list.
 */
function mergeAuthoritativeFirstPage(
  existing: CachedConnection,
  incoming: CachedConnection,
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
    const id = readEdgeNodeId(edge);
    if (id) incomingIds.add(id);
  }

  const coversWholeList = !incoming.pageInfo?.hasNextPage;
  const tail = coversWholeList
    ? []
    : edgesPastFirstPage(existingEdges, incomingEdges, incomingIds);

  return {
    ...incoming,
    edges: tail.length > 0 ? [...incomingEdges, ...tail] : incomingEdges,
    // A surviving tail means the loaded window still extends past this page, so
    // the cached cursor — not this page's — describes where `fetchMore` resumes.
    ...(tail.length > 0 && existing.pageInfo
      ? { pageInfo: existing.pageInfo }
      : {}),
  };
}

/** A by-id field the server answered `null` while the device held the record. */
interface MissingAtVersion {
  missingAtVersion: number | null;
}

const isMissingAtVersion = (value: unknown): value is MissingAtVersion =>
  isRecord(value) && 'missingAtVersion' in value;

/**
 * A by-id root field (`pantryItem(id)`) reads the `typename` entity the cache
 * holds, so a row created on the device reads back before the server has it.
 * A `null` answered over a held record keeps that record's version: it reads
 * again only once a copy of another version is written, as when an add reuses
 * a line moved off the list under the same id.
 */
export function readByIdFromCache(typename: string): FieldPolicy {
  return {
    // Stated: with both `read` and `merge`, Apollo defaults to `keyArgs: false`
    // and every id would share one entry.
    keyArgs: ['id'],
    merge(
      _existing,
      incoming: unknown,
      { args, toReference, canRead, readField },
    ) {
      if (incoming !== null) return incoming;
      const ref = toReference({ __typename: typename, id: args?.id as string });
      if (!canRead(ref)) return null;
      const missing: MissingAtVersion = {
        missingAtVersion: readField<number>('version', ref) ?? null,
      };
      return missing;
    },
    read(existing: unknown, { args, toReference, canRead, readField }) {
      const missing = isMissingAtVersion(existing);
      if (!missing && existing !== undefined && existing !== null) {
        return existing;
      }
      const ref = toReference({ __typename: typename, id: args?.id as string });
      if (!canRead(ref)) return missing ? null : existing;
      if (!missing) return ref;
      const version = readField<number>('version', ref) ?? null;
      return version === existing.missingAtVersion ? null : ref;
    },
  };
}

/**
 * Connection merge where fresh data wins on duplicate node ids, for a
 * connection with no paginated window; an append-only paginated list uses
 * {@link itemsConnectionFieldPolicy}.
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
      { args }: FieldFunctionOptions<{ after?: string | null }>,
    ) {
      if (!incoming) return existing;
      if (!existing) return incoming;
      if (!args?.after) {
        // No cursor means a refresh, not a page: it replaces the window it
        // covers. Gating on `!hasNextPage` would hide every removal and reorder
        // in a list long enough to paginate.
        return mergeAuthoritativeFirstPage(existing, incoming);
      }

      const edgeMap = new Map<string, CachedEdge>();
      const existingEdges = existing.edges ?? [];
      existingEdges.forEach((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge);
        if (id) edgeMap.set(id, edge);
      });
      const existingCount = edgeMap.size;
      (incoming.edges ?? []).forEach((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge);
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
 * Paginated append-only merge: existing edges keep their positions, only new
 * node ids are appended, and the window is capped at MAX_WINDOW_EDGES. Use
 * {@link mergeConnectionByNodeId} where fresh data should overwrite duplicates.
 */
export function itemsConnectionFieldPolicy(keyArgs: string[] = ['filters']) {
  return {
    keyArgs,
    // Apollo's broken-ref filter handles plain lists, never a nested
    // `edge.node`: an evicted entity would render as a phantom row.
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
      { args }: FieldFunctionOptions<{ after?: string | null }>,
    ) {
      if (!incoming) return existing;
      if (!existing) return incoming;
      if (!args?.after) {
        // No cursor means a refresh: gating on `!hasNextPage` too would hide
        // every removal and reorder in a list long enough to paginate.
        return mergeAuthoritativeFirstPage(existing, incoming);
      }

      // Append-only: keep existing edges in place, add only new incoming edges
      const existingIds = new Set<string>();
      for (const edge of existing.edges ?? []) {
        const id = readEdgeNodeId(edge);
        if (id) existingIds.add(id);
      }

      const newEdges = (incoming.edges ?? []).filter((edge: CachedEdge) => {
        const id = readEdgeNodeId(edge);
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
