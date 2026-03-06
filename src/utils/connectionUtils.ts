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
 */
export const extractNodes = <T>(
  connection?: {
    edges?: Array<Edge<T>> | null;
  } | null,
): T[] => {
  if (!connection?.edges) {
    return [];
  }

  return connection.edges.map(edge => edge?.node).filter(isDefined);
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
 * // Create a pantry normalizer
 * const normalizePantry = createEntityNormalizer<PantryLike>([
 *   { connectionField: 'itemsConnection', arrayName: 'items', includeTotalCount: true, includePageInfo: true },
 *   { connectionField: 'storageLocationsConnection', arrayName: 'storageLocations', includeTotalCount: true, includePageInfo: true },
 * ]);
 *
 * const normalized = normalizePantry(pantry);
 * // Returns: { ...pantry, items: [...], itemsTotalCount: 10, itemsPageInfo: {...}, storageLocations: [...], ... }
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

type HomeLike = {
  id?: string;
  name?: string;
  type?: string;
  description?: string | null;
  timezone?: string | null;
  currency?: string | null;
  isPublic?: boolean;
  joinCode?: string | null;
  allowJoinCode?: boolean | null;
  maxMembers?: number | null;
  tags?: string[] | null;
  metadata?: Record<string, any> | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  membersConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
  invitesConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
  pantriesConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
  shoppingListsConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
  mealPlansConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
  mealTemplatesConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
};

type PantryLike = {
  itemsConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
  storageLocationsConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
};

type ShoppingListLike = {
  itemsConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
};

type RecipesConnectionLike = {
  edges?: Array<Edge<any>> | null;
  totalCount?: number | null;
  pageInfo?: PageInfo | null;
};

export type NormalizedHome<T extends HomeLike> = T & {
  members: any[];
  invites: any[];
  pantries: any[];
  shoppingLists: any[];
  mealPlans: any[];
  mealTemplates: any[];
  membersTotalCount: number;
  invitesTotalCount: number;
  pantriesTotalCount: number;
  membersPageInfo?: PageInfo;
  invitesPageInfo?: PageInfo;
  pantriesPageInfo?: PageInfo;
};

export type NormalizedPantry<T extends PantryLike> = T & {
  items: any[];
  storageLocations: any[];
  itemsTotalCount: number;
  storageLocationsTotalCount: number;
  itemsPageInfo?: PageInfo;
  storageLocationsPageInfo?: PageInfo;
};

export type NormalizedShoppingList<T extends ShoppingListLike> = T & {
  items: any[];
  itemsTotalCount: number;
  itemsPageInfo?: PageInfo;
};

export type NormalizedRecipes = {
  recipes: any[];
  totalCount: number;
  pageInfo?: PageInfo;
};

/**
 * Normalizes a Home object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizeHome = createEntityNormalizer<HomeLike>([
  {
    connectionField: 'membersConnection',
    arrayName: 'members',
    includeTotalCount: true,
    includePageInfo: true,
  },
  {
    connectionField: 'invitesConnection',
    arrayName: 'invites',
    includeTotalCount: true,
    includePageInfo: true,
  },
  {
    connectionField: 'pantriesConnection',
    arrayName: 'pantries',
    includeTotalCount: true,
    includePageInfo: true,
  },
  {
    connectionField: 'shoppingListsConnection',
    arrayName: 'shoppingLists',
    includeTotalCount: true,
  },
  {
    connectionField: 'mealPlansConnection',
    arrayName: 'mealPlans',
    includeTotalCount: true,
  },
  {
    connectionField: 'mealTemplatesConnection',
    arrayName: 'mealTemplates',
    includeTotalCount: true,
  },
]) as <T extends HomeLike>(home?: T | null) => NormalizedHome<T> | null;

/**
 * Normalizes an array of Home objects
 */
export const normalizeHomes = <T extends HomeLike>(
  homes?: Array<T | null | undefined>,
): NormalizedHome<T>[] => {
  if (!homes) {
    return [];
  }

  return homes
    .map(home => normalizeHome(home))
    .filter(isDefined) as NormalizedHome<T>[];
};

/**
 * Normalizes a Pantry object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizePantry = createEntityNormalizer<PantryLike>([
  {
    connectionField: 'itemsConnection',
    arrayName: 'items',
    includeTotalCount: true,
    includePageInfo: true,
  },
  {
    connectionField: 'storageLocationsConnection',
    arrayName: 'storageLocations',
    includeTotalCount: true,
    includePageInfo: true,
  },
]) as <T extends PantryLike>(pantry?: T | null) => NormalizedPantry<T> | null;

/**
 * Normalizes a ShoppingList object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizeShoppingList = createEntityNormalizer<ShoppingListLike>([
  {
    connectionField: 'itemsConnection',
    arrayName: 'items',
    includeTotalCount: true,
    includePageInfo: true,
  },
]) as <T extends ShoppingListLike>(
  shoppingList?: T | null,
) => NormalizedShoppingList<T> | null;

/**
 * Normalizes a RecipesConnection object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizeRecipes = (
  recipesConnection?: RecipesConnectionLike | null,
): NormalizedRecipes | null => {
  return normalizeConnection(
    recipesConnection,
    'recipes',
  ) as NormalizedRecipes | null;
};
