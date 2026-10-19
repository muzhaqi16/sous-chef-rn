import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { GetShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemDetail_ShoppingListItemFragmentDoc } from '#features/shoppingList/screens/ItemDetail.generated';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { useDataState } from '#hooks/data/useDataState';

/** The line a detail screen shows: what the cache holds now, the rest once fetched. */
export function useShoppingListItemDetail(itemId: string) {
  // A line created on this device owns its id before the server does, so a
  // fetch before the create lands could only answer that there is no such line.
  const isUnconfirmed = useIsCreateUnconfirmed(itemId);

  // Fetches the detail-only fields into the entity read below. Its own `data`
  // is read only for a miss: the list's row is a subset of the detail, so the
  // query reads nothing from the cache until it has answered once.
  const { data, loading, error, refetch } = useQuery(
    GetShoppingListItemDocument,
    isUnconfirmed
      ? skipToken
      : { variables: { id: itemId }, fetchPolicy: 'cache-and-network' },
  );

  // Keyed by ENTITY, so the row the list cached renders at once — offline too —
  // and a write made elsewhere (AddEditItem) refreshes it without a refetch.
  // Partial until the detail answers; without a name nothing was cached.
  const live = useFragment({
    fragment: ItemDetail_ShoppingListItemFragmentDoc,
    fragmentName: 'ItemDetail_shoppingListItem',
    from: { __typename: 'ShoppingListItem', id: itemId },
  });
  const item =
    live.complete || live.data.itemName !== undefined ? live.data : null;

  // Every by-id query reports a removed line as an explicit null. Trusted only
  // once the create is acknowledged, and only from a settled read.
  const notFound =
    !isUnconfirmed && !loading && !error && data?.shoppingListItem === null;

  const state = useDataState({
    // Skipped while unconfirmed: the acknowledgement is what fires the fetch.
    loading: loading || isUnconfirmed,
    error,
    hasResult: item !== null,
    isEmpty: item === null,
  });

  const retry = () => {
    if (isUnconfirmed) return;
    void refetch();
  };

  return {
    item,
    // For a section made only of fields the list's row never caches.
    detail: live.complete ? live.data : null,
    notFound,
    state,
    retry,
  };
}
