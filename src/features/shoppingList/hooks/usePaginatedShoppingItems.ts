import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client/react';
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

  // Adjusting state during render — a ref must never be read or written there.
  const [previousListId, setPreviousListId] = useState<
    string | null | undefined
  >(listId);
  const listIdChanged = previousListId !== listId;
  if (listIdChanged) {
    setPreviousListId(listId);
  }

  // Defer purchased query until JS thread is idle — it's for the non-default tab
  const [purchasedReady, setPurchasedReady] = useState(false);
  if (listIdChanged) {
    setPurchasedReady(false);
  }

  useEffect(() => {
    if (shouldSkip) return;
    const id = requestIdleCallback(() => setPurchasedReady(true));
    return () => cancelIdleCallback(id);
  }, [shouldSkip, listId]);

  const {
    data: unpurchasedData,
    loading: uLoading,
    error: uError,
    fetchMore: uFetchMore,
    refetch: uRefetch,
  } = useQuery(GetShoppingListItemsFilteredDocument, {
    variables: {
      id: listId!,
      first: PAGINATION.ITEMS_PAGE_SIZE,
      isPurchased: false,
    },
    skip: shouldSkip,
  });

  const {
    data: purchasedData,
    loading: pLoading,
    error: pError,
    fetchMore: pFetchMore,
    refetch: pRefetch,
  } = useQuery(GetShoppingListItemsFilteredDocument, {
    variables: {
      id: listId!,
      first: PAGINATION.ITEMS_PAGE_SIZE,
      isPurchased: true,
    },
    skip: shouldSkip || !purchasedReady,
  });

  useApolloErrorLogger('GetShoppingListItemsFiltered[unpurchased]', uError);
  useApolloErrorLogger('GetShoppingListItemsFiltered[purchased]', pError);

  // The parent query selects inline scalar meta at `node` beside the masked ref,
  // so search/sort/modal lookups read it without a `cache.readFragment` hop.
  const unpurchased = useConnectionData({
    data: unpurchasedData,
    selector: d => d.shoppingList?.itemsConnection,
    loading: uLoading,
    fetchMore: uFetchMore,
    refetch: uRefetch,
  });

  const purchased = useConnectionData({
    data: purchasedData,
    selector: d => d.shoppingList?.itemsConnection,
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

  const handleRefetch = async () => {
    await Promise.all([
      refetchQuietly(
        uRefetch,
        '[usePaginatedShoppingItems] Unpurchased refetch failed:',
      ),
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
      error: (uError ?? pError) as Error | undefined,
      isTransitioning: listIdChanged && (uLoading || pLoading),
    },
    actions: {
      refetch: handleRefetch,
    },
  };
}
