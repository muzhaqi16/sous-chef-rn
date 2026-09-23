type Edge<T> = {
  node?: T | null;
} | null;

const isDefined = <T>(value: T | null | undefined): value is T => value != null;

/**
 * Nodes from a Relay-style connection, null edges dropped. Keyed by the edges
 * array REFERENCE, so Apollo re-delivering the same edges returns the same array
 * and does not re-render everything downstream.
 */
const extractNodesCache = new WeakMap<readonly unknown[], unknown[]>();

export const extractNodes = <T>(
  connection?: {
    edges?: Array<Edge<T>> | null;
  } | null,
): T[] => {
  if (!connection?.edges) {
    return [];
  }

  const edges = connection.edges;
  const cached = extractNodesCache.get(edges);
  if (cached) return cached as T[];

  const result = edges.map(edge => edge?.node).filter(isDefined);
  extractNodesCache.set(edges, result);
  return result;
};

/** `totalCount`, falling back to the number of extracted nodes. */
export const getConnectionTotalCount = (
  connection?: {
    totalCount?: number | null;
    edges?: Array<Edge<unknown>> | null;
  } | null,
): number => {
  if (typeof connection?.totalCount === 'number') {
    return connection.totalCount;
  }

  return extractNodes(connection).length;
};

// --- Typed normalizers ---
