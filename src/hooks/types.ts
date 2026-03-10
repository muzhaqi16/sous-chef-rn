/**
 * Standard pagination state returned by hooks that support cursor-based pagination.
 * Used by usePagination and consumed by hooks that compose pagination.
 */
export interface PaginationState {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void> | void;
}

/**
 * Grouped return type for hooks with 6+ return properties.
 * Separates reactive state from callable actions, with optional metadata.
 *
 * @template S - State object type (reactive values: data, loading, errors, pagination indicators)
 * @template A - Actions object type (callable functions: mutations, refetch, loadMore)
 * @template M - Optional metadata type (derived/computed read-only values)
 */
export type HookReturn<S, A, M = undefined> = M extends undefined
  ? { state: S; actions: A }
  : { state: S; actions: A; meta: M };
