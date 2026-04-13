import { extractNodes, getConnectionTotalCount } from '#/utils/connectionUtils';
import { usePagination } from '#hooks/utils/usePagination';

/**
 * Structural constraint matching codegen connection types as they appear
 * in query results. Queries typically select only `hasNextPage` + `endCursor`
 * from PageInfo, so we require only those fields rather than the full
 * codegen `PageInfo` type.
 *
 * All codegen connection types (RecipeConnection, ShoppingListItemConnection,
 * PantryItemConnection, etc.) satisfy this constraint.
 */
export type ConnectionResult = {
  edges: Array<{ node: any }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount?: number | null;
};

/** Extract the node type from a connection's edges */
export type NodeOfConnection<C extends ConnectionResult> =
  C['edges'] extends Array<{ node: infer N }> ? N : never;

export interface UseConnectionDataConfig<TData, C extends ConnectionResult> {
  /** Apollo query data */
  data: TData | undefined;
  /** Selector to extract the connection from query data */
  selector: (data: TData) => C | null | undefined;
  /** Whether the query is currently loading */
  loading: boolean;
  /** Apollo fetchMore function */
  fetchMore: (options: any) => Promise<any>;
  /** Additional variables for fetchMore (e.g., parent entity ID, filters) */
  fetchMoreVariables?: Record<string, any>;
  /** Cursor variable name (default: 'after') */
  cursorVariableName?: string;
}

export interface ConnectionData<TNode> {
  items: TNode[];
  /** Total count from the connection, or undefined when no connection data exists yet */
  totalCount: number | undefined;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  loadMoreError: boolean;
}

/**
 * Composes `extractNodes` + `getConnectionTotalCount` + `usePagination`
 * into a single reusable hook for any cursor-paginated connection.
 *
 * The consumer calls their own Apollo query hook (with entity-specific
 * skip/policy config) and passes the result here via `data` + `selector`.
 *
 * Node types are inferred automatically from the codegen query type —
 * no manual type annotations needed at the call site.
 *
 * @example
 * const unpurchased = useConnectionData({
 *   data: unpurchasedData,   // GetShoppingListItemsFilteredQuery
 *   selector: (d) => d.shoppingList?.itemsConnection,
 *   loading: uLoading,
 *   fetchMore: uFetchMore,
 * });
 * // unpurchased.items is ShoppingListItemDisplayFragment[]
 */
export function useConnectionData<TData, C extends ConnectionResult>(
  config: UseConnectionDataConfig<TData, C>,
): ConnectionData<NodeOfConnection<C>> {
  const {
    data,
    selector,
    loading,
    fetchMore,
    fetchMoreVariables,
    cursorVariableName = 'after',
  } = config;

  const connection = data ? selector(data) : undefined;
  const items = extractNodes(connection) as NodeOfConnection<C>[];
  const totalCount = connection
    ? getConnectionTotalCount(connection)
    : undefined;

  const pagination = usePagination({
    pageInfo: connection?.pageInfo,
    loading,
    itemCount: items.length,
    fetchMore,
    fetchMoreVariables,
    cursorVariableName,
  });

  return {
    items,
    totalCount,
    hasMore: pagination.hasMore,
    isLoadingMore: pagination.isLoadingMore,
    loadMore: pagination.loadMore,
    loadMoreError: pagination.loadMoreError,
  };
}
