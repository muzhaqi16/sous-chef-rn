import { useQuery } from '@apollo/client/react';
import { usePagination } from '#hooks/utils/usePagination';
import { GetPantryItemUsageHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';
import type { UsageRecord } from '#features/pantry/types';

const PAGE_SIZE = 30;

/** One page of a pantry item's usage ledger, oldest cursor forward. */
export function usePantryUsageHistory(pantryItemId: string) {
  const { data, loading, error, refetch, observable } = useQuery(
    GetPantryItemUsageHistoryDocument,
    {
      variables: { pantryItemId, first: PAGE_SIZE },
      // NOT the app-wide `'all'`: a field error nulls the non-null
      // `usageRecordsConnection` and so `pantryItem`, and `'all'` WRITES that null onto
      // `ROOT_QUERY.pantryItem({id})` — the field the detail screen reads —
      // where it sticks and persists to MMKV.
      errorPolicy: 'none',
    },
  );

  const connection = data?.pantryItem?.usageRecordsConnection;
  const records: UsageRecord[] = connection?.edges.map(e => e.node) ?? [];

  const totalCount = connection?.totalCount ?? records.length;
  const {
    hasMore: hasNextPage,
    isLoadingMore: isFetchingMore,
    loadMore,
  } = usePagination({
    pageInfo: connection?.pageInfo,
    loading,
    itemCount: records.length,
    observable,
    cursorVariableName: 'after',
    restart: refetch,
  });

  // A failed read is not an empty ledger — `useDataState` also splits offline
  // out of error so the retry is offered only where retrying can help.
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: records.length === 0,
  });

  const retry = () => {
    // Under `errorPolicy: 'none'` a failed refetch REJECTS rather than
    // resolving with the error, so this catch runs on an ordinary failure too.
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PantryUsageHistory.retry',
      }),
    );
  };

  return {
    records,
    totalCount,
    state,
    loadMore,
    hasNextPage,
    isFetchingMore,
    retry,
  };
}
