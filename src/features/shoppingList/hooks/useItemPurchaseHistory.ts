import { useQuery } from '@apollo/client/react';
import {
  GetItemPurchaseHistoryDocument,
  type GetItemPurchaseHistoryQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';

const PAGE_SIZE = 30;

/** One purchase of an item, as the history list renders it. */
export type PurchaseItem = NonNullable<
  GetItemPurchaseHistoryQuery['shoppingListItem']
>['purchasesConnection']['edges'][number]['node'];

/**
 * An item's purchase ledger, fetched on demand: the detail screen carries only
 * the summary, and a frequently re-bought item runs past one page.
 */
export function useItemPurchaseHistory(itemId: string) {
  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    GetItemPurchaseHistoryDocument,
    {
      variables: { itemId, first: PAGE_SIZE },
      notifyOnNetworkStatusChange: true,
      // NOT the app-wide `'all'`: a field error inside the non-null
      // `purchasesConnection` nulls `shoppingListItem`, and `'all'` WRITES that
      // null onto `ROOT_QUERY.shoppingListItem({id})` — the field ItemDetail
      // reads — where it sticks (the redirect fires only on `undefined`) and
      // persists to MMKV. The cost of `'none'` is losing a partial page.
      errorPolicy: 'none',
    },
  );

  const connection = data?.shoppingListItem?.purchasesConnection;
  const purchases: PurchaseItem[] =
    connection?.edges?.map(edge => edge.node) ?? [];

  const totalCount = connection?.totalCount ?? purchases.length;
  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;
  // networkStatus 3 = fetchMore in flight.
  const isFetchingMore = networkStatus === 3;

  const loadMore = () => {
    if (!hasNextPage || !endCursor || loading || isFetchingMore) return;
    // fetchMore rejects on network/GraphQL errors; catch it so a failed page
    // doesn't surface as an unhandled promise rejection.
    void fetchMore({
      variables: { itemId, first: PAGE_SIZE, after: endCursor },
    }).catch(fetchError =>
      errorService.reportError(fetchError, {
        operation: 'PurchaseHistory.loadMore',
      }),
    );
  };

  // A failed read is not an empty history: rendering both as the empty state
  // advises buying something the user may already own, exactly when the app
  // cannot know. `useDataState` also splits offline out of error.
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: purchases.length === 0,
  });

  const retry = () => {
    // Under `errorPolicy: 'none'` a failed refetch REJECTS rather than
    // resolving with the error, so this catch runs on an ordinary failure too.
    void refetch().catch(refetchError =>
      errorService.reportError(refetchError, {
        operation: 'PurchaseHistory.retry',
      }),
    );
  };

  return { purchases, totalCount, state, loadMore, isFetchingMore, retry };
}
