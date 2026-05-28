import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { PAGINATION } from '#/constants/shoppingList';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  useConnectionData,
  type ConnectionData,
} from '#hooks/utils/useConnectionData';
import { executeRefetch } from '#/utils/compilerSafeWrappers';
import type { HookReturn } from '#hooks/types';

/**
 * Node shape emitted by the GetShoppingListItemsFiltered query.
 * Carries inline meta fields (id, itemName, category, sortOrder, version, ...)
 * for direct hook-layer access, plus the masked `SortableItem_item` fragment
 * ref consumed by the row component via `useFragment`.
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
 * Fetches paginated shopping list items via two independent queries (unpurchased + purchased).
 *
 * Each tab gets its own cursor, cache entry, and fetchMore to avoid alias-based
 * cross-contamination. Apollo's `keyArgs: ['filters']` on `itemsConnection` ensures
 * separate cache entries per `isPurchased` filter value.
 *
 * @param options - Configuration with `listId` and optional `skip` flag
 * @returns `{ state, actions }` — state contains unpurchased/purchased connection data,
 *   loading, and error; actions contains refetch
 */
export function usePaginatedShoppingItems({
  listId,
  skip = false,
}: UsePaginatedShoppingItemsOptions): UsePaginatedShoppingItemsResult {
  const isLoggedOut = useIsLoggedOut();

  const hasValidListId = !!listId && !isLoggedOut;
  const shouldSkip = skip || !hasValidListId;

  // Track previous listId to detect list switches (compiler-safe pattern)
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

  // --- Two independent queries ---
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

  // --- Extract + paginate via useConnectionData ---
  // The parent query selects inline scalar meta fields at `node` alongside
  // the masked `SortableItem_item` ref, so consumers (search, sort, modal
  // lookups) read directly without a `cache.readFragment` round-trip.
  const unpurchased = useConnectionData({
    data: unpurchasedData,
    selector: d => d.shoppingList?.itemsConnection,
    loading: uLoading,
    fetchMore: uFetchMore,
  });

  const purchased = useConnectionData({
    data: purchasedData,
    selector: d => d.shoppingList?.itemsConnection,
    loading: pLoading,
    fetchMore: pFetchMore,
  });

  // --- Refetch both queries ---
  const handleRefetch = async () => {
    await Promise.all([
      executeRefetch(
        uRefetch,
        '[usePaginatedShoppingItems] Unpurchased refetch failed:',
      ),
      executeRefetch(
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
