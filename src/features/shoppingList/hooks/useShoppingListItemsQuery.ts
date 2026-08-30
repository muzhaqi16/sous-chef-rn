import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GetShoppingListDetailsDocument,
  type GetShoppingListDetailsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export type ShoppingListDetail = NonNullable<
  GetShoppingListDetailsQuery['shoppingList']
>;

/**
 * List details WITHOUT items — permissions, collaborators, home membership.
 * The items come separately from `usePaginatedShoppingItems`.
 */
export function useShoppingListItemsQuery(listId: string | null | undefined) {
  const isLoggedOut = useIsLoggedOut();

  const hasValidListId = !!listId && !isLoggedOut;

  // Client defaults apply: cache-and-network with errorPolicy 'all', so cached
  // data still renders when the network leg fails.
  const { data, previousData, loading, error, refetch } = useQuery(
    GetShoppingListDetailsDocument,
    {
      variables: {
        id: listId!,
      },
      skip: !hasValidListId,
    },
  );

  useApolloErrorLogger('GetShoppingListDetails', error);

  // Adjusting state during render (never a ref, never an effect): on a list
  // switch `previousData` belongs to the OLD list and must not be fallen back to.
  const [previousListId, setPreviousListId] = useState<
    string | null | undefined
  >(listId);
  const listIdChanged = previousListId !== listId;
  if (listIdChanged) {
    setPreviousListId(listId);
  }

  const shoppingList: ShoppingListDetail | null = listIdChanged
    ? data?.shoppingList ?? null
    : data?.shoppingList ?? previousData?.shoppingList ?? null;

  // The server returned an explicit null for this list — it was deleted/unshared
  // (a missing by-id record is null data, not a NOT_FOUND error). Distinct from
  // an access-revoked read, which still surfaces as a FORBIDDEN `error`.
  // Gated on !loading/!listIdChanged so a transition's stale null can't flag a
  // freshly selected list as missing before its own fetch resolves.
  const notFound =
    !listIdChanged && !loading && !error && data?.shoppingList === null;

  return {
    shoppingList,
    notFound,
    loading,
    error,
    refetch,
  };
}
