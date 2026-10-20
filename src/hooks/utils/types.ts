/** Cursor-pagination state, produced by `usePagination`. */
export interface PaginationState {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void> | void;
}

/** Grouped return for hooks with 6+ properties: reactive state vs actions. */
export type HookReturn<S, A, M = undefined> = M extends undefined
  ? { state: S; actions: A }
  : { state: S; actions: A; meta: M };
