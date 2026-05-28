// =============================================================================
// Core Types
// =============================================================================

type Edge<T> = {
  node?: T | null;
} | null;

type PageInfo = {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null | undefined;
  endCursor?: string | null | undefined;
};

type Connection<T = any> = {
  edges?: Array<Edge<T>> | null;
  totalCount?: number | null;
  pageInfo?: PageInfo | null;
};

const isDefined = <T>(value: T | null | undefined): value is T => value != null;

// =============================================================================
// Core Utilities
// =============================================================================

/**
 * Extracts nodes from a Relay-style connection, filtering out null edges/nodes.
 *
 * PERFORMANCE: WeakMap cache returns the same array when the same edges array
 * reference is passed. This prevents unnecessary re-renders downstream when
 * Apollo re-delivers the same edge objects from its normalized cache.
 */
const extractNodesCache = new WeakMap<readonly any[], any[]>();

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

/**
 * Returns the reported totalCount for a connection, falling back to the
 * number of extracted nodes when totalCount is unavailable.
 */
export const getConnectionTotalCount = (
  connection?: {
    totalCount?: number | null;
    edges?: Array<Edge<any>> | null;
  } | null,
): number => {
  if (typeof connection?.totalCount === 'number') {
    return connection.totalCount;
  }

  return extractNodes(connection).length;
};

// =============================================================================
// Generic Normalization Utilities
// =============================================================================

/**
 * Configuration for normalizing a single connection field
 */
export interface ConnectionFieldConfig {
  /** Name of the connection field (e.g., 'itemsConnection') */
  connectionField: string;
  /** Name for the normalized array (e.g., 'items') */
  arrayName: string;
  /** Whether to include totalCount (default: false) */
  includeTotalCount?: boolean;
  /** Whether to include pageInfo (default: false) */
  includePageInfo?: boolean;
}

/**
 * Generic function to normalize a single Connection field within an entity
 *
 * @example
 * const config: ConnectionFieldConfig = {
 *   connectionField: 'itemsConnection',
 *   arrayName: 'items',
 *   includeTotalCount: true,
 *   includePageInfo: true,
 * };
 * const result = normalizeConnectionField(pantry, config);
 * // Returns: { items: [...], itemsTotalCount: 10, itemsPageInfo: {...} }
 */
export function normalizeConnectionField<T extends Record<string, any>>(
  entity: T,
  config: ConnectionFieldConfig,
): Record<string, any> {
  const connection = entity[config.connectionField] as Connection | undefined;

  const result: Record<string, any> = {
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

/**
 * Creates a normalization function for entities with multiple Connection fields
 *
 * This factory function eliminates the need for separate normalize functions
 * for each entity type. It generates a type-safe normalizer based on configuration.
 *
 * @example
 * // Create a shopping list normalizer
 * const normalizeShoppingList = createEntityNormalizer<ShoppingListLike>([
 *   { connectionField: 'itemsConnection', arrayName: 'items', includeTotalCount: true, includePageInfo: true },
 * ]);
 *
 * const normalized = normalizeShoppingList(shoppingList);
 * // Returns: { ...shoppingList, items: [...], itemsTotalCount: 10, itemsPageInfo: {...} }
 */
export function createEntityNormalizer<T extends Record<string, any>>(
  configs: ConnectionFieldConfig[],
) {
  return (entity?: T | null): (T & Record<string, any>) | null => {
    if (!entity) {
      return null;
    }

    const normalized: Record<string, any> = { ...entity };

    configs.forEach(config => {
      const fields = normalizeConnectionField(entity, config);
      Object.assign(normalized, fields);
    });

    return normalized as T & Record<string, any>;
  };
}

/**
 * Normalizes a standalone Connection (not nested in an entity)
 *
 * Use this for query results that return Connection directly:
 * - Query.recipes (returns RecipeConnection)
 * - Any paginated query returning Connection at root level
 *
 * @example
 * const result = normalizeConnection(recipesConnection, 'recipes');
 * // Returns: { recipes: [...], totalCount: 25, pageInfo: {...} }
 */
export function normalizeConnection<T = any>(
  connection?: Connection<T> | null,
  arrayName: string = 'items',
): { [key: string]: any; totalCount: number; pageInfo?: PageInfo } | null {
  if (!connection) {
    return null;
  }

  return {
    [arrayName]: extractNodes(connection),
    totalCount: getConnectionTotalCount(connection),
    pageInfo: connection.pageInfo || undefined,
  };
}

// =============================================================================
// Typed Normalizer Functions
// =============================================================================
