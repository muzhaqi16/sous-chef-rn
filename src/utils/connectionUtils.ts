type Edge<T> = {
  node?: T | null;
} | null;

type PageInfo = {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null | undefined;
  endCursor?: string | null | undefined;
};

type Connection<T = unknown> = {
  edges?: Array<Edge<T>> | null;
  totalCount?: number | null;
  pageInfo?: PageInfo | null;
};

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

export interface ConnectionFieldConfig {
  /** e.g. 'itemsConnection' */
  connectionField: string;
  /** e.g. 'items'; also prefixes the `…TotalCount` / `…PageInfo` keys. */
  arrayName: string;
  includeTotalCount?: boolean;
  includePageInfo?: boolean;
}

export function normalizeConnectionField<T extends Record<string, unknown>>(
  entity: T,
  config: ConnectionFieldConfig,
): Record<string, unknown> {
  const connection = entity[config.connectionField] as Connection | undefined;

  const result: Record<string, unknown> = {
    [config.arrayName]: extractNodes(connection),
  };

  if (config.includeTotalCount) {
    result[`${config.arrayName}TotalCount`] =
      getConnectionTotalCount(connection);
  }

  if (config.includePageInfo) {
    result[`${config.arrayName}PageInfo`] = connection?.pageInfo || undefined;
  }

  return result;
}

/** Builds a normalizer for an entity with several Connection fields. */
export function createEntityNormalizer<T extends Record<string, unknown>>(
  configs: ConnectionFieldConfig[],
) {
  // The added fields are keyed by each config's runtime `arrayName`, so they
  // cannot be typed statically; callers narrow at the read site.
  return (entity?: T | null): (T & Record<string, unknown>) | null => {
    if (!entity) {
      return null;
    }

    const normalized: Record<string, unknown> = { ...entity };

    configs.forEach(config => {
      const fields = normalizeConnectionField(entity, config);
      Object.assign(normalized, fields);
    });

    return normalized as T & Record<string, unknown>;
  };
}

/** For a query returning a Connection at the root, not nested in an entity. */
export function normalizeConnection<T = unknown>(
  connection?: Connection<T> | null,
  arrayName: string = 'items',
  // Keyed under the runtime `arrayName`, so it cannot be typed statically.
): { [key: string]: unknown; totalCount: number; pageInfo?: PageInfo } | null {
  if (!connection) {
    return null;
  }

  return {
    [arrayName]: extractNodes(connection),
    totalCount: getConnectionTotalCount(connection),
    pageInfo: connection.pageInfo || undefined,
  };
}

// --- Typed normalizers ---
