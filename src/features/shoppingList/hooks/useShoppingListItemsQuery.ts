import { skipToken, useQuery } from '@apollo/client/react';
import {
  GetShoppingListDetailsDocument,
  type GetShoppingListDetailsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { errorService } from '#/services/errorService';
import { isAbortError } from '#features/shoppingList/utils/abort';

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
  const {
    data: result,
    variables,
    previousData,
    loading,
    error,
    refetch,
  } = useQuery(
    GetShoppingListDetailsDocument,
    listId && !isLoggedOut ? { variables: { id: listId } } : skipToken,
  );
  // `skipToken` keeps the last run's variables AND data, so a result for a
  // previous list is dropped.
  const data = variables.id === listId ? result : undefined;

  useApolloErrorLogger(GetShoppingListDetailsDocument, error);

  const refetchDetails = async () => {
    if (!hasValidListId) return;
    try {
      await refetch();
    } catch (refetchError) {
      if (isAbortError(refetchError)) return;
      errorService.reportError(refetchError, {
        operation: 'ShoppingListItemsQuery.refetch',
      });
    }
  };

  // `previousData` is not variable-scoped: after a list switch it holds the OLD
  // list, so it is a fallback only while it is this list's.
  const previousList = previousData?.shoppingList;
  const shoppingList: ShoppingListDetail | null =
    data?.shoppingList ??
    (previousList && previousList.id === listId ? previousList : null);

  // The server returned an explicit null for this list — it was deleted/unshared
  // (a missing by-id record is null data, not a NOT_FOUND error). Distinct from
  // an access-revoked read, which still surfaces as a FORBIDDEN `error`. `data`
  // always answers the current `listId` (a switch re-reads it during render).
  const notFound = !loading && !error && data?.shoppingList === null;

  return {
    shoppingList,
    notFound,
    loading,
    error,
    refetch: refetchDetails,
  };
}
