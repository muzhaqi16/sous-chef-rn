type Edge<T> = {
  node?: T | null;
} | null;

const isDefined = <T>(value: T | null | undefined): value is T => value != null;

/**
 * Extracts nodes from a Relay-style connection, filtering out null edges/nodes.
 */
export const extractNodes = <T>(connection?: {
  edges?: Array<Edge<T>> | null;
} | null): T[] => {
  if (!connection?.edges) {
    return [];
  }

  return connection.edges
    .map(edge => edge?.node)
    .filter(isDefined);
};

/**
 * Returns the reported totalCount for a connection, falling back to the
 * number of extracted nodes when totalCount is unavailable.
 */
export const getConnectionTotalCount = (connection?: {
  totalCount?: number | null;
  edges?: Array<Edge<any>> | null;
} | null): number => {
  if (typeof connection?.totalCount === 'number') {
    return connection.totalCount;
  }

  return extractNodes(connection).length;
};

type PageInfo = {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null | undefined;
  endCursor?: string | null | undefined;
};

type HomeLike = {
  membersConnection?: {
    edges?: Array<Edge<any>> | null;
    pageInfo?: PageInfo | null;
  } | null;
  invitesConnection?: {
    edges?: Array<Edge<any>> | null;
    pageInfo?: PageInfo | null;
  } | null;
  pantriesConnection?: {
    edges?: Array<Edge<any>> | null;
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

export type NormalizedHome<T extends HomeLike> = T & {
  members: any[];
  invites: any[];
  pantries: any[];
  membersPageInfo?: PageInfo;
  invitesPageInfo?: PageInfo;
  pantriesPageInfo?: PageInfo;
};

/**
 * Normalizes a Home object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizeHome = <T extends HomeLike>(
  home?: T | null,
): NormalizedHome<T> | null => {
  if (!home) {
    return null;
  }

  return {
    ...home,
    members: extractNodes(home.membersConnection),
    invites: extractNodes(home.invitesConnection),
    pantries: extractNodes(home.pantriesConnection),
    membersPageInfo: home.membersConnection?.pageInfo || undefined,
    invitesPageInfo: home.invitesConnection?.pageInfo || undefined,
    pantriesPageInfo: home.pantriesConnection?.pageInfo || undefined,
  };
};

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

export type NormalizedPantry<T extends PantryLike> = T & {
  items: any[];
  storageLocations: any[];
  itemsTotalCount: number;
  storageLocationsTotalCount: number;
  itemsPageInfo?: PageInfo;
  storageLocationsPageInfo?: PageInfo;
};

/**
 * Normalizes a Pantry object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizePantry = <T extends PantryLike>(
  pantry?: T | null,
): NormalizedPantry<T> | null => {
  if (!pantry) {
    return null;
  }

  return {
    ...pantry,
    items: extractNodes(pantry.itemsConnection),
    storageLocations: extractNodes(pantry.storageLocationsConnection),
    itemsTotalCount: getConnectionTotalCount(pantry.itemsConnection),
    storageLocationsTotalCount: getConnectionTotalCount(
      pantry.storageLocationsConnection,
    ),
    itemsPageInfo: pantry.itemsConnection?.pageInfo || undefined,
    storageLocationsPageInfo:
      pantry.storageLocationsConnection?.pageInfo || undefined,
  };
};

type ShoppingListLike = {
  itemsConnection?: {
    edges?: Array<Edge<any>> | null;
    totalCount?: number | null;
    pageInfo?: PageInfo | null;
  } | null;
};

export type NormalizedShoppingList<T extends ShoppingListLike> = T & {
  items: any[];
  itemsTotalCount: number;
  itemsPageInfo?: PageInfo;
};

/**
 * Normalizes a ShoppingList object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizeShoppingList = <T extends ShoppingListLike>(
  shoppingList?: T | null,
): NormalizedShoppingList<T> | null => {
  if (!shoppingList) {
    return null;
  }

  return {
    ...shoppingList,
    items: extractNodes(shoppingList.itemsConnection),
    itemsTotalCount: getConnectionTotalCount(shoppingList.itemsConnection),
    itemsPageInfo: shoppingList.itemsConnection?.pageInfo || undefined,
  };
};

type RecipesConnectionLike = {
  edges?: Array<Edge<any>> | null;
  totalCount?: number | null;
  pageInfo?: PageInfo | null;
};

export type NormalizedRecipes = {
  recipes: any[];
  totalCount: number;
  pageInfo?: PageInfo;
};

/**
 * Normalizes a RecipesConnection object by flattening Connection edges to arrays
 * and preserving pagination metadata for future fetchMore operations.
 */
export const normalizeRecipes = (
  recipesConnection?: RecipesConnectionLike | null,
): NormalizedRecipes | null => {
  if (!recipesConnection) {
    return null;
  }

  return {
    recipes: extractNodes(recipesConnection),
    totalCount: getConnectionTotalCount(recipesConnection),
    pageInfo: recipesConnection.pageInfo || undefined,
  };
};
