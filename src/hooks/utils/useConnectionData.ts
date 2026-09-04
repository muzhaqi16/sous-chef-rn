import { usePagination, type FetchMoreFn } from '#hooks/utils/usePagination';
import { usePreservedConnection } from '#hooks/apollo/usePreservedConnection';

/**
 * Structural constraint over codegen connection types AS SELECTED: only
 * `hasNextPage` + `endCursor`, not the full codegen `PageInfo`.
 */
export type ConnectionResult = {
  edges: Array<{ node: unknown }>;
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
  fetchMore: FetchMoreFn;
  /** Additional variables for fetchMore (e.g., parent entity ID, filters) */
  fetchMoreVariables?: Record<string, unknown>;
  /** Cursor variable name (default: 'after') */
  cursorVariableName?: string;
  /**
   * Apollo `refetch`. Re-reads the collection from page one when the server
   * refuses the stored cursor, which otherwise strands the list. Optional so an
   * existing caller keeps compiling; pass it wherever the query exposes one.
   */
  refetch?: () => Promise<unknown>;
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
 * Node extraction + total count + `usePagination` for any cursor-paginated
 * connection. The caller runs its own query and passes `data` + `selector`; node
 * types are inferred from the codegen query type.
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
    refetch,
  } = config;

  const connection = data ? selector(data) : undefined;
  // Preserved BEFORE extracting nodes, or a transient blip flattens
  // `undefined → []` and wipes a list still safely in the cache.
  const preserved = usePreservedConnection(connection);
  const items = preserved.nodes;
  const totalCount = preserved.totalCount;

  const pagination = usePagination({
    pageInfo: preserved.pageInfo,
    loading,
    itemCount: items.length,
    fetchMore,
    fetchMoreVariables,
    cursorVariableName,
    restart: refetch,
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
