import { useApolloClient, useQuery } from '@apollo/client/react';
import { loadPageWithCursorRecovery } from '#hooks/utils/cursorRecovery';
import { GetPantryItemBatchHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';

const PAGE_SIZE = 30;

/** Active batches first in FIFO order, then the inactive history. */
const byActiveThenExpiry = (
  a: PantryItemBatchFragment,
  b: PantryItemBatchFragment,
) => {
  const aActive = a.status === BatchStatus.Active ? 0 : 1;
  const bActive = b.status === BatchStatus.Active ? 0 : 1;
  if (aActive !== bActive) return aActive - bActive;
  if (aActive === 1) return a.batchNumber - b.batchNumber;
  if (!a.expiresAt && !b.expiresAt) return a.batchNumber - b.batchNumber;
  if (!a.expiresAt) return 1;
  if (!b.expiresAt) return -1;
  return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
};

/** A pantry item's batch ledger, materialized out from behind data masking. */
export function usePantryBatchHistory(pantryItemId: string) {
  const client = useApolloClient();

  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetPantryItemBatchHistoryDocument,
    {
      variables: { pantryItemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`: a field error would write a null over
      // `ROOT_QUERY.pantryItemBatchesConnection(...)`, which the detail screen
      // reads to derive its costs, where it sticks and persists to MMKV.
      errorPolicy: 'none',
    },
  );

  const connection = data?.pantryItemBatchesConnection;
  // Edges arrive MASKED, so `edge.node.status` is undefined — materialize each
  // before sorting or counting by it, as the detail screen does.
  const materialized = (connection?.edges ?? []).map(edge =>
    client.cache.readFragment<PantryItemBatchFragment>({
      fragment: PantryItemBatchFragmentDoc,
      fragmentName: 'PantryItemBatchFragment',
      from: edge.node,
    }),
  );
  // `readFragment` returns null for a PARTIALLY cached batch exactly as for a
  // missing one, so a dropped row would vanish while every count still had it.
  const unreadable = materialized.filter(b => b == null).length;

  const batches: PantryItemBatchFragment[] = materialized
    .filter((b): b is PantryItemBatchFragment => b != null)
    .sort(byActiveThenExpiry);

  const totalCount = connection?.totalCount ?? batches.length;
  // Only describes the whole connection once every page is loaded — otherwise
  // it counts the loaded window and would climb as the reader scrolls a pantry
  // that did not change. `unreadable` rows are in `totalCount` but not here.
  const allPagesLoaded = !connection?.pageInfo?.hasNextPage && unreadable === 0;
  const activeCount = allPagesLoaded
    ? batches.filter(b => b.status === BatchStatus.Active).length
    : null;
  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;
  // networkStatus 3 = fetchMore in flight.
  const isFetchingMore = networkStatus === 3;

  const loadMore = () => {
    if (!hasNextPage || !endCursor || loading || isFetchingMore) return;
    void loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables: { pantryItemId, first: PAGE_SIZE, after: endCursor },
      operation: 'PantryBatchHistory.loadMore',
    });
  };

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: batches.length === 0,
  });

  const retry = () => {
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PantryBatchHistory.retry',
      }),
    );
  };

  return {
    batches,
    totalCount,
    activeCount,
    state,
    loadMore,
    isFetchingMore,
    retry,
  };
}
