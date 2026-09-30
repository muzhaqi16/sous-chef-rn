import { useEffect, useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import {
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  useConnectionData,
  type ConnectionData,
} from '#hooks/utils/useConnectionData';
import { errorService } from '#/services/errorService';
import { isAbortError } from '#features/shoppingList/utils/abort';
import type { HookReturn } from '#hooks/types';

/**
 * Carries inline meta fields for direct hook-layer access plus the masked
 * `SortableItem_item` ref the row component reads via `useFragment`.
 */
export type ShoppingListItemNode = NonNullable<
  NonNullable<
    GetShoppingListItemsFilteredQuery['shoppingList']
  >['itemsConnection']
>['edges'][number]['node'];

interface UsePaginatedShoppingItemsOptions {
  listId: string | null | undefined;
  skip?: boolean;
}

interface PaginatedShoppingItemsState {
  unpurchased: ConnectionData<ShoppingListItemNode>;
  purchased: ConnectionData<ShoppingListItemNode>;
  loading: boolean;
  error: Error | undefined;
  isTransitioning: boolean;
}

interface PaginatedShoppingItemsActions {
  refetch: () => Promise<void>;
}

type UsePaginatedShoppingItemsResult = HookReturn<
  PaginatedShoppingItemsState,
  PaginatedShoppingItemsActions
>;

/**
 * Two independent queries, one per tab, so each gets its own cursor and
 * `fetchMore` with no alias-based cross-contamination — `keyArgs: ['filters']`
 * on `itemsConnection` is what keeps their cache entries separate.
 */
export function usePaginatedShoppingItems({
  listId,
  skip = false,
}: UsePaginatedShoppingItemsOptions): UsePaginatedShoppingItemsResult {
  const isLoggedOut = useIsLoggedOut();

  const hasValidListId = !!listId && !isLoggedOut;
  const shouldSkip = skip || !hasValidListId;

  // Defer purchased query until JS thread is idle — it's for the non-default
  // tab. Recorded per list, so a switch defers the new list's read again.
  const [purchasedReadyFor, setPurchasedReadyFor] = useState<
    string | null | undefined
  >(null);
  const purchasedReady = purchasedReadyFor === listId;

  useEffect(() => {
    if (shouldSkip) return;
    const id = requestIdleCallback(() => setPurchasedReadyFor(listId));
    return () => cancelIdleCallback(id);
  }, [shouldSkip, listId]);

  const unpurchasedListId = !shouldSkip && listId ? listId : null;
  const purchasedListId = purchasedReady ? unpurchasedListId : null;

  const {
    data: unpurchasedResult,
    variables: unpurchasedVariables,
    loading: uLoading,
    error: uError,
    fetchMore: uFetchMore,
    refetch: uRefetch,
  } = useQuery(
    GetShoppingListItemsFilteredDocument,
    unpurchasedListId
      ? {
          variables: {
            id: unpurchasedListId,
            first: PAGINATION.ITEMS_PAGE_SIZE,
            isPurchased: false,
          },
        }
      : skipToken,
  );

  const {
    data: purchasedResult,
    variables: purchasedVariables,
    loading: pLoading,
    error: pError,
    fetchMore: pFetchMore,
    refetch: pRefetch,
  } = useQuery(
    GetShoppingListItemsFilteredDocument,
    purchasedListId
      ? {
          variables: {
            id: purchasedListId,
            first: PAGINATION.ITEMS_PAGE_SIZE,
            isPurchased: true,
          },
        }
      : skipToken,
  );

  // `skipToken` keeps the last run's variables AND data: a list switch must not
  // serve the previous list's rows while the new one's query is skipped.
  const unpurchasedData =
    unpurchasedVariables.id === listId ? unpurchasedResult : undefined;
  const purchasedData =
    purchasedVariables.id === listId ? purchasedResult : undefined;

  useApolloErrorLogger(GetShoppingListItemsFilteredDocument, uError);
  useApolloErrorLogger(GetShoppingListItemsFilteredDocument, pError);

  // The parent query selects inline scalar meta at `node` beside the masked ref,
  // so search/sort/modal lookups read it without a `cache.readFragment` hop.
  const unpurchased = useConnectionData({
    data: unpurchasedData,
    selector: d => d.shoppingList?.itemsConnection,
    key: listId ?? '',
    loading: uLoading,
    fetchMore: uFetchMore,
    refetch: uRefetch,
  });

  const purchased = useConnectionData({
    data: purchasedData,
    selector: d => d.shoppingList?.itemsConnection,
    key: listId ?? '',
    loading: pLoading,
    fetchMore: pFetchMore,
    refetch: pRefetch,
  });

  const refetchQuietly = async (
    refetch: () => Promise<unknown>,
    operation: string,
  ) => {
    try {
      await refetch();
    } catch (error) {
      if (isAbortError(error)) return;
      errorService.reportError(error, { operation });
    }
  };

  // A skipped query may never have run, and then has no variables to send.
  const handleRefetch = async () => {
    await Promise.all([
      unpurchasedListId &&
        refetchQuietly(
          uRefetch,
          '[usePaginatedShoppingItems] Unpurchased refetch failed:',
        ),
      purchasedListId &&
        refetchQuietly(
          pRefetch,
          '[usePaginatedShoppingItems] Purchased refetch failed:',
        ),
    ]);
  };

  // Only block on unpurchased (the default tab); purchased is deferred
  const loading = uLoading && unpurchased.items.length === 0;

  return {
    state: {
      unpurchased,
      purchased,
      loading,
      error: uError ?? pError,
      isTransitioning:
        (uLoading || pLoading) && unpurchasedData?.shoppingList?.id !== listId,
    },
    actions: {
      refetch: handleRefetch,
    },
  };
}
