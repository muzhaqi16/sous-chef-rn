import { useQuery } from '@apollo/client/react';
import { GetPantryItemUsageHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import type { UsageRecord } from '#features/pantry/components/UsageHistoryRow';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';

const PAGE_SIZE = 30;

/** One page of a pantry item's usage ledger, oldest cursor forward. */
export function usePantryUsageHistory(pantryItemId: string) {
  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetPantryItemUsageHistoryDocument,
    {
      variables: { pantryItemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`: a field error nulls the non-null
      // `usageRecords` and so `pantryItem`, and `'all'` WRITES that null onto
      // `ROOT_QUERY.pantryItem({id})` — the field the detail screen reads —
      // where it sticks and persists to MMKV.
      errorPolicy: 'none',
    },
  );

  const connection = data?.pantryItem?.usageRecords;
  const records: UsageRecord[] = connection?.edges?.map(e => e.node) ?? [];

  const totalCount = connection?.totalCount ?? records.length;
  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;
  // networkStatus 3 = fetchMore in flight.
  const isFetchingMore = networkStatus === 3;

  const loadMore = () => {
    if (!hasNextPage || !endCursor || loading || isFetchingMore) return;
    void fetchMore({
      variables: { pantryItemId, first: PAGE_SIZE, after: endCursor },
    }).catch(fetchError =>
      errorService.reportError(fetchError, {
        operation: 'PantryUsageHistory.loadMore',
      }),
    );
  };

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

  return { records, totalCount, state, loadMore, isFetchingMore, retry };
}
