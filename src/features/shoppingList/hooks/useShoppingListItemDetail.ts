import { useFragment, useQuery } from '@apollo/client/react';
import { GetShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ItemDetail_ShoppingListItemFragmentDoc } from '#features/shoppingList/screens/ItemDetail.generated';

/**
 * The item a detail screen shows. `cache-and-network` because the detail selects
 * fields the list never caches, and `cache-first` would skip the fetch whenever
 * a partial entity looks complete, leaving the screen blank.
 */
export function useShoppingListItemDetail(itemId: string) {
  const { data } = useQuery(GetShoppingListItemDocument, {
    variables: { id: itemId },
    fetchPolicy: 'cache-and-network',
  });

  // Subscribes to the entity record, so an edit made elsewhere (AddEditItem)
  // refreshes the detail view without a refetch.
  const itemRef = data?.shoppingListItem ?? null;
  const result = useFragment({
    fragment: ItemDetail_ShoppingListItemFragmentDoc,
    fragmentName: 'ItemDetail_shoppingListItem',
    from: itemRef,
  });

  return {
    item: itemRef && result.complete ? result.data : null,
    // Whether the query has answered at all — a missing item and one still
    // being fetched read the same on `item` alone.
    hasLoaded: data !== undefined,
  };
}
