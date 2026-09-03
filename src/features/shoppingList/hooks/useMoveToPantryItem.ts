import { useFragment, useQuery } from '@apollo/client/react';
import {
  MoveToPantryModal_ShoppingListItemFragmentDoc,
  MoveToPantryPurchaseInfoDocument,
} from '#features/shoppingList/components/moveToPantry/MoveToPantryModal.generated';

interface UseMoveToPantryItemArgs {
  shoppingListItemId: string | null | undefined;
  skip: boolean;
}

/** The line being moved, and what was actually bought on it. */
export function useMoveToPantryItem({
  shoppingListItemId,
  skip,
}: UseMoveToPantryItemArgs) {
  const { data, complete } = useFragment({
    fragment: MoveToPantryModal_ShoppingListItemFragmentDoc,
    fragmentName: 'MoveToPantryModal_shoppingListItem',
    from: shoppingListItemId
      ? { __typename: 'ShoppingListItem', id: shoppingListItemId }
      : null,
  });

  // A query rather than a field on the fragment above: that one gates the whole
  // sheet on `complete`, and the list query caches only
  // `{ isPurchased movedToPantryAt }` — so on a cold start the missing amounts
  // would blank the sheet instead of just the prefill. `cache-first` means no
  // network leg once they are cached.
  const { data: purchaseData } = useQuery(MoveToPantryPurchaseInfoDocument, {
    variables: { id: shoppingListItemId ?? '' },
    skip: skip || !shoppingListItemId,
    fetchPolicy: 'cache-first',
    // NOT the app-wide `'all'`: a field error nulls the non-null `purchaseInfo`
    // and so `shoppingListItem`, and `'all'` WRITES that null onto
    // `ROOT_QUERY.shoppingListItem({id})` — the field ItemDetail reads — where
    // it sticks and persists to MMKV. Losing the prefill costs far less.
    errorPolicy: 'none',
  });

  const purchaseInfo = purchaseData?.shoppingListItem?.purchaseInfo ?? null;

  return {
    shoppingListItem: shoppingListItemId && complete ? data : null,
    purchasedQuantity: purchaseInfo?.isPurchased
      ? purchaseInfo.purchasedQuantity ?? null
      : null,
    // PER UNIT, as the API stores it; the caller shows the total.
    purchasedUnitPrice: purchaseInfo?.isPurchased
      ? purchaseInfo.purchasedPrice ?? null
      : null,
    // What the purchase was recorded in. Only reached when the LINE carries no
    // unit of its own — the two agree otherwise, since the server derives one
    // from the other.
    purchasedUnit:
      purchaseData?.shoppingListItem?.purchasesConnection?.edges?.[0]?.node ??
      null,
  };
}
