import { usePagination } from '#/hooks/utils';

interface UsePantryPaginationProps {
  pantryId: string | undefined;
  pageInfo: any; // PageInfo from normalizePantry
  loading: boolean;
  itemCount: number;
  fetchMore: any;
}

/**
 * Hook for managing pantry item pagination
 * Wraps generic pagination utility with pantry-specific configuration
 */
export function usePantryPagination({
  pantryId,
  pageInfo,
  loading,
  itemCount,
  fetchMore,
}: UsePantryPaginationProps) {
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo,
    loading,
    itemCount,
    fetchMore,
    fetchMoreVariables: { id: pantryId },
    cursorVariableName: 'itemsCursor',
  });

  return {
    hasMore,
    loadMore,
    isLoadingMore,
  };
}
